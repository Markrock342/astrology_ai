import type { ConversationMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { assertCanRequestReading } from "@/server/horoscope/access-policy";
import {
  deductCredits,
  lockWalletForUpdate,
} from "@/server/credit/credit-service";
import {
  assertWithinUsageLimits,
  releaseUsageReservation,
  reserveUsageSlot,
} from "@/server/credit/quota-service";
import {
  generateWithFallback,
  resolveConfig,
  streamWithFallback,
} from "@/server/ai/router";
import {
  classifyProviderFailure,
  logProviderAlert,
  providerAlertUserMessage,
} from "@/server/ai/provider-alerts";
import {
  buildSystemPrompt,
  buildConversationHistory,
} from "@/server/ai/prompt-builder";
import type { PriorThreadMessage } from "@/server/ai/prompt-builder";
import { logUsage } from "@/server/ai/usage-logger";
import { estimateCostUsd } from "@/config/ai-pricing";
import {
  assertUsableEngineChart,
  requireReadyNatalChart,
} from "@/server/horoscope/chart-context";
import { getOrRefreshChartMemory } from "@/server/horoscope/chart-memory-service";
import {
  getOrComputeDailyTransit,
  questionWantsTodayTransit,
} from "@/server/horoscope/daily-transit-service";
import { resolvePromptParts } from "@/server/horoscope/prompt-resolver";
import {
  generateFollowUpMeta,
  type FollowUpMeta,
} from "@/server/horoscope/follow-up-suggestions";
import {
  BRIEF_ANSWER_HINT,
  BRIEF_MAX_OUTPUT_TOKENS_FREE,
  BRIEF_MAX_OUTPUT_TOKENS_PRO,
  FREE_MAX_OUTPUT_TOKENS,
  KNOWLEDGE_MAX_CHARS,
  PRO_MAX_OUTPUT_TOKENS,
} from "@/config/constants";
import type { ChartJson } from "@/types/chart";
import type { BirthProfileSnapshot } from "@/types";

/**
 * Orchestrates the reading flow (spec 5.6). Enforces the four hard rules:
 *   - quota slot reserved under lock BEFORE any AI call (SUCCESS + RESERVED count)
 *   - AI failure/timeout => release reservation, NO credit charged
 *   - retry / double-click => idempotencyKey returns the existing reading
 *   - credit deduction + reading + usage finalize committed in ONE transaction
 *
 * Engine-first: every Gemini call gets natal + user chart memory (+ transit when needed).
 */

export type TransitSnapshotInput = {
  date: Date;
  time?: string | null;
  country?: string | null;
  province?: string | null;
  district?: string | null;
};

/** Join knowledge docs in sortOrder until the character budget is reached. */
export function buildKnowledgePrompt(
  docs: Array<{ title: string; content: string }>,
  maxChars = KNOWLEDGE_MAX_CHARS,
): string | undefined {
  if (docs.length === 0) return undefined;

  const header = "ความรู้อ้างอิง (ใช้ประกอบการตอบ):\n\n";
  const parts: string[] = [];
  let used = header.length;

  for (const doc of docs) {
    const block = `## ${doc.title}\n${doc.content}`;
    const separator = parts.length > 0 ? 2 : 0;
    if (used + separator + block.length > maxChars) break;
    parts.push(block);
    used += separator + block.length;
  }

  return parts.length > 0 ? header + parts.join("\n\n") : undefined;
}

/** Cap output tokens by plan while respecting Admin config ceiling. */
export type AnswerMode = "brief" | "detailed";

/** UX Wave F — staged thinking phases emitted over SSE before the first delta. */
export type ChatPrepPhase = "chart" | "memory" | "writing";
export type ChatChartSnapshots = {
  chartSnapshot: ChartJson;
  transitSnapshot: ChartJson | null;
};

export function resolveMaxOutputTokens(
  plan: "FREE" | "PRO",
  configMaxOutputTokens: number,
  answerMode: AnswerMode = "detailed",
): number {
  const planCap =
    plan === "PRO" ? PRO_MAX_OUTPUT_TOKENS : FREE_MAX_OUTPUT_TOKENS;
  const briefCap =
    plan === "PRO" ? BRIEF_MAX_OUTPUT_TOKENS_PRO : BRIEF_MAX_OUTPUT_TOKENS_FREE;
  const modeCap = answerMode === "brief" ? briefCap : planCap;
  return Math.min(configMaxOutputTokens, modeCap);
}

export type CreateReadingInput = {
  userId: string;
  categorySlug: string;
  question: string;
  idempotencyKey?: string;
  /** Prior messages in the conversation (oldest first), excluding the new question. */
  priorMessages?: PriorThreadMessage[];
  mode?: ConversationMode;
  transit?: TransitSnapshotInput | null;
  answerMode?: AnswerMode;
  /** Optional hook for SSE phased status (chart → memory → writing). */
  onPhase?: (phase: ChatPrepPhase) => void;
  /** Emit deterministic chart UI as soon as chart preparation completes. */
  onCharts?: (charts: ChatChartSnapshots) => void;
};

export async function createReading(input: CreateReadingInput) {
  return runReading(input);
}

/** Same as createReading but streams text chunks to onDelta (Khui-like UX). */
export async function streamReading(
  input: CreateReadingInput,
  onDelta: (chunk: string) => void,
  shouldStop?: () => Promise<boolean>,
) {
  return runReading(input, onDelta, shouldStop);
}

async function runReading(
  input: CreateReadingInput,
  onDelta?: (chunk: string) => void,
  shouldStop?: () => Promise<boolean>,
) {
  const {
    userId,
    categorySlug,
    question,
    idempotencyKey,
    priorMessages,
    onPhase,
    onCharts,
  } = input;
  const mode = input.mode ?? "NATAL";

  // 0. Idempotency: if we already produced a reading for this key, return it.
  if (idempotencyKey) {
    const existing = await prisma.horoscopeReading.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing) {
      const natalChart = await requireReadyNatalChart(userId).catch(() => null);
      if (existing.responseText && onDelta) onDelta(existing.responseText);
      return {
        ...existing,
        chartSnapshot: natalChart,
        transitSnapshot: null as ChartJson | null,
      };
    }
  }

  // 1. User must be active.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  if (user.status === "DISABLED") {
    throw new AppError("USER_DISABLED", "This account is disabled");
  }

  // 2. Category must exist and be enabled.
  const category = await prisma.horoscopeCategory.findUnique({
    where: { slug: categorySlug },
  });
  if (!category || !category.enabled) {
    throw new AppError("NOT_FOUND", "Category not available");
  }

  // 3. Free may spend its trial credits, within the walls in access-policy.
  // Follow-ups are allowed on Free — each turn still spends a credit.
  const plan = await assertCanRequestReading({
    userId,
    categoryAccessLevel: category.accessLevel,
    mode,
    isFollowUp: (priorMessages?.length ?? 0) > 0,
  });

  // Chart phase — natal + optional transit evidence.
  onPhase?.("chart");
  const [profile, wallet, , natalChartRaw] = await Promise.all([
    prisma.birthProfile.findUnique({ where: { userId } }),
    prisma.creditWallet.findUnique({ where: { userId } }),
    assertWithinUsageLimits(userId),
    requireReadyNatalChart(userId),
  ]);
  if (!profile) throw new AppError("VALIDATION", "Birth profile is required");
  if ((wallet?.balance ?? 0) < category.creditCost) {
    throw new AppError("NO_QUOTA", "Not enough credit");
  }

  const natalChart = assertUsableEngineChart(natalChartRaw);
  const birthInput = natalChart.input;
  const snapshot: BirthProfileSnapshot = {
    nickname: profile.nickname,
    // Never expose the storage UTC instant as the user's civil birth date.
    // Before 07:00 in Thailand its ISO date is the previous day.
    birthDate: `${birthInput.day}/${birthInput.month}/${birthInput.year + 543} (พ.ศ.; ${birthInput.year} ค.ศ. ตามวันที่ท้องถิ่นไทย)`,
    birthTime: profile.birthTime,
    birthTimeKnown: profile.birthTimeKnown,
    gender: profile.gender,
    birthLocation: profile.birthLocation,
    additionalInfo: profile.additionalInfo,
  };

  async function loadTransitChart(): Promise<ChartJson | null> {
    if (mode === "TRANSIT") {
      if (!input.transit?.date) {
        throw new AppError(
          "VALIDATION",
          "โหมดดวงจรต้องระบุวันเวลา/สถานที่สำหรับคำนวณดวงจร",
        );
      }
      try {
        return await getOrComputeDailyTransit(userId, natalChart, {
          date: input.transit.date,
          time: input.transit.time,
          scrapeTimeoutMs: 500,
        });
      } catch (err) {
        if (err instanceof AppError) throw err;
        const message =
          err instanceof Error ? err.message : "คำนวณดวงจรไม่สำเร็จ";
        throw new AppError("CHART_NOT_READY", message);
      }
    }
    if (questionWantsTodayTransit(question)) {
      try {
        return await getOrComputeDailyTransit(userId, natalChart, {
          scrapeTimeoutMs: 500,
        });
      } catch (err) {
        console.warn(
          "[transit] daily cache miss failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return null;
  }

  const transitChart = await loadTransitChart();
  onCharts?.({
    chartSnapshot: natalChart,
    transitSnapshot: transitChart,
  });

  // Memory phase — chart memory, config, knowledge, prompt assembly.
  onPhase?.("memory");
  // Brief mode routes to the fast lite model (see resolveConfig) — resolved
  // here so the config fetch already reflects the chosen answer mode.
  const answerMode = input.answerMode ?? "detailed";
  const [chartMemory, config, knowledgeDocs] = await Promise.all([
    getOrRefreshChartMemory(userId, natalChart),
    resolveConfig(category.id, plan, { preferFast: answerMode === "brief" }),
    prisma.knowledgeDoc.findMany({
      where: {
        enabled: true,
        OR: [{ categoryId: category.id }, { categoryId: null }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const templateId = category.promptTemplateId ?? config.promptTemplateId;

  const promptParts = await resolvePromptParts({
    plan,
    categoryName: category.nameTh,
    categoryDescription: category.description,
    personaTemplateId: templateId,
  });
  const knowledge = buildKnowledgePrompt(knowledgeDocs);

  let systemPrompt = buildSystemPrompt({
    ...promptParts,
    knowledge,
  });
  if (answerMode === "brief") {
    systemPrompt = `${systemPrompt}\n\n${BRIEF_ANSWER_HINT}`;
  }
  const { conversationHistory, userPrompt } = buildConversationHistory(
    priorMessages ?? [],
    snapshot,
    natalChart,
    question,
    {
      chartMemory,
      categorySlug,
      transitChartJson: transitChart,
    },
  );

  // Final guard: refuse AI if engine table somehow missing from the prompt.
  if (!userPrompt.includes("[natal]") || !userPrompt.includes("[memory]")) {
    throw new AppError(
      "CHART_NOT_READY",
      "Engine chart/memory missing from prompt",
    );
  }
  if (mode === "TRANSIT" && !userPrompt.includes("[transit]")) {
    throw new AppError(
      "CHART_NOT_READY",
      "Transit engine chart missing from prompt",
    );
  }

  // Writing phase — reserve quota then call the model.
  onPhase?.("writing");
  const reservationId = await reserveUsageSlot({
    userId,
    creditCost: category.creditCost,
    provider: config.provider,
    modelId: config.modelId,
  });

  // Everything past the reservation runs under a release-on-throw guard. A
  // RESERVED row counts against quota, and an error escaping here (DB blip,
  // provider crash, expired reservation) used to leave it behind forever —
  // each leak permanently eating one of the user's monthly readings.
  // releaseUsageReservation only deletes rows still in RESERVED, so calling it
  // after the charge tx (row is SUCCESS) or after an inner release is a no-op.
  try {
    const maxOutputTokens = resolveMaxOutputTokens(
      plan,
      config.maxOutputTokens,
      answerMode,
    );
    const aiInput = {
      systemPrompt,
      userPrompt,
      conversationHistory:
        conversationHistory.length > 0 ? conversationHistory : undefined,
      maxOutputTokens,
    };

    const result = onDelta
      ? await streamWithFallback(config.id, aiInput, onDelta, shouldStop)
      : await generateWithFallback(config.id, aiInput);

    // On failure/timeout: release reservation, log failure, DO NOT charge.
    // An explicit stop with no text yet is a cancelled turn — not a provider error.
    if (result.stopped && !result.rawText?.trim()) {
      await releaseUsageReservation(reservationId);
      await logUsage({
        userId,
        provider: result.provider,
        modelId: result.modelId,
        status: "FAILED",
        latencyMs: result.latencyMs,
        errorCode: "STOPPED",
        errorMessage: "User stopped before text arrived",
      });
      return {
        id: "",
        responseText: "หยุดการทำนายแล้ว (ไม่ถูกหักเครดิตเพราะยังไม่มีคำตอบ)",
        provider: result.provider,
        modelId: result.modelId,
        creditCost: 0,
        status: "FAILED" as const,
        chartSnapshot: null,
        transitSnapshot: null,
      };
    }

    if (!result.ok || !result.rawText) {
      await releaseUsageReservation(reservationId);
      await logUsage({
        userId,
        provider: result.provider,
        modelId: result.modelId,
        status: result.errorCode === "TIMEOUT" ? "TIMEOUT" : "FAILED",
        latencyMs: result.latencyMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
      const alert = classifyProviderFailure(
        result.errorCode,
        result.errorMessage,
      );
      logProviderAlert(alert, {
        modelId: result.modelId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
      const code =
        result.errorCode === "TIMEOUT" ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR";
      throw new AppError(
        code,
        providerAlertUserMessage(alert) ??
          result.errorMessage ??
          "AI request failed",
      );
    }

    // A MAX_TOKENS cut ends mid-sentence with no signal. Surface it honestly so
    // the user knows to ask for the rest, instead of a silently missing ending.
    const responseText = result.truncated
      ? `${result.rawText.trimEnd()}\n\n*คำตอบยาวถึงเพดานของโหมดคำตอบ — พิมพ์ “เล่าต่อ” เพื่อฟังส่วนที่เหลือ*`
      : result.rawText;

    // Success => charge tx: finalize reservation, deduct credit, persist reading.
    const reading = await prisma.$transaction(async (tx) => {
      await lockWalletForUpdate(userId, tx);

      const reserved = await tx.aIUsageLog.findFirst({
        where: { id: reservationId, userId, status: "RESERVED" },
        select: { id: true },
      });
      if (!reserved) {
        throw new AppError(
          "INTERNAL",
          "Usage reservation expired — please retry",
        );
      }

      const created = await tx.horoscopeReading.create({
        data: {
          userId,
          idempotencyKey,
          birthProfileSnapshotJson: snapshot as object,
          categoryId: category.id,
          question,
          responseJson: (result.parsed as object | undefined) ?? undefined,
          responseText,
          provider: result.provider,
          modelId: result.modelId,
          promptTemplateId: templateId ?? undefined,
          promptVersion: undefined,
          status: "SUCCESS",
          creditCost: category.creditCost,
        },
      });

      await deductCredits(
        userId,
        category.creditCost,
        { type: "AI_USAGE", referenceType: "reading", referenceId: created.id },
        tx,
      );

      await tx.aIUsageLog.update({
        where: { id: reservationId },
        data: {
          status: "SUCCESS",
          readingId: created.id,
          // The reservation was created with the PRIMARY model id. If the router
          // fell back to another model, this row must reflect the one that
          // actually ran — otherwise its estimatedCost (priced on the fallback)
          // and the admin's per-model attribution disagree with reality.
          provider: result.provider,
          modelId: result.modelId,
          inputUsage: result.usage?.inputTokens,
          outputUsage: result.usage?.outputTokens,
          latencyMs: result.latencyMs,
          firstTokenMs: result.firstTokenMs,
          // The billable row is UPDATED from its reservation, so it never passes
          // through logUsage() — price it here or the one row that actually
          // costs money is the one row with no cost on it. Cache hits are
          // priced at 10%, so this is the true bill, not a list-price guess.
          estimatedCost: estimateCostUsd(
            result.modelId,
            result.usage?.inputTokens,
            result.usage?.outputTokens,
            result.usage?.cachedTokens,
          ),
        },
      });

      return created;
    });

    // Meta (summaryLine + follow-up chips) is a second Flash-Lite call. Awaiting
    // it here used to hold the SSE `done` event — and with it the caret, the
    // message actions, and the follow-up chips — hostage for up to its full
    // timeout AFTER the answer had already finished typing. Kick it off and hand
    // the promise back so the route can send `done` now and deliver meta later.
    // Only the streaming path consumes it; the legacy 202 path never ships meta.
    const metaPromise: Promise<FollowUpMeta> = onDelta
      ? generateFollowUpMeta({
          userId,
          question,
          answer: result.rawText,
          categoryName: category.nameTh,
          categoryId: category.id,
          planScope: plan,
        })
      : Promise.resolve({ followUps: [] });

    return {
      ...reading,
      chartSnapshot: natalChart,
      transitSnapshot: transitChart,
      metaPromise,
    };
  } catch (err) {
    await releaseUsageReservation(reservationId).catch(() => {});
    throw err;
  }
}
