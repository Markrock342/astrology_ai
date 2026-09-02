import type { ConversationMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { assertCanRequestReading } from "@/server/horoscope/access-policy";
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
import {
  AI_PRICING_VERSION,
  estimateCostUsd,
} from "@/config/ai-pricing";
import {
  assertHasUsageBudget,
  deductUsageCost,
  usageUnitsFromUsd,
} from "@/server/usage/usage-budget-service";
import {
  assertUsableEngineChart,
  requireReadyNatalChart,
} from "@/server/horoscope/chart-context";
import { getOrRefreshChartMemory } from "@/server/horoscope/chart-memory-service";
import {
  bangkokTimeHm,
  getOrComputeDailyTransit,
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
  DETAILED_ANSWER_HINT_FREE,
  DETAILED_ANSWER_HINT_PRO,
  FREE_MAX_OUTPUT_TOKENS,
  GEMINI_DETAILED_FIRST_TOKEN_MS,
  KNOWLEDGE_MAX_CHARS,
  PRO_MAX_OUTPUT_TOKENS,
} from "@/config/constants";
import { isDetailedGeminiModel } from "@/config/gemini-models";
import type { ChartJson } from "@/types/chart";
import type { BirthProfileSnapshot } from "@/types";
import {
  CATEGORY_INTRO_SYSTEM_HINT,
  formatIntakeForPrompt,
} from "@/lib/intake-survey";
import { parseIntakeAnswers } from "@/server/user/intake-service";
import { UNIFIED_CHAT_INSTRUCTION } from "@/lib/question-scope";
import { assertQuestionAllowedForPlan } from "@/server/horoscope/question-scope";
import {
  formatUserAiMemoryForPrompt,
  getUserAiMemory,
} from "@/server/user/ai-memory-service";

/**
 * Orchestrates the reading flow (spec 5.6). Enforces the four hard rules:
 *   - quota slot reserved under lock BEFORE any AI call (SUCCESS + RESERVED count)
 *   - AI failure/timeout => release reservation, NO usage charged
 *   - retry / double-click => idempotencyKey returns the existing reading
 *   - usage deduction + reading + log finalize committed in ONE transaction
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
    // Provider/source names are internal implementation details and must never
    // be echoed by the model into the customer-facing reading.
    const publicText = (text: string) =>
      text
        .replace(/myhora(?:\.com)?/gi, "หลักโหราศาสตร์ไทย")
        .replace(/\bweb[\s-]*scrap(?:e|ed|ing)?\b/gi, "การรวบรวมข้อมูล")
        .replace(/\bscrap(?:e|ed|ing)?\b/gi, "การรวบรวมข้อมูล")
        .replace(/\bfallback\b/gi, "แนวทางสำรอง");
    const block = `## ${publicText(doc.title)}\n${publicText(doc.content)}`;
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

/** Wait longer for Gemini 3.7 thinking before the first visible token. */
export function resolveAiTimeoutMs(
  modelId: string,
  configTimeoutMs: number | null | undefined,
  answerMode: AnswerMode = "detailed",
): number {
  const configured =
    typeof configTimeoutMs === "number" && Number.isFinite(configTimeoutMs)
      ? configTimeoutMs
      : 30_000;
  const thinkingWait =
    answerMode === "detailed" && isDetailedGeminiModel(modelId)
      ? GEMINI_DETAILED_FIRST_TOKEN_MS
      : 0;
  return Math.max(configured, thinkingWait);
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
  /** Natal category briefing — no credit, no quota slot. */
  purpose?: "category_intro";
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
  const skipCredits = input.purpose === "category_intro";

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
    skipEmailVerify: skipCredits,
  });

  if (!skipCredits) {
    await assertQuestionAllowedForPlan({
      plan,
      question,
    });
  }

  // Chart phase — natal + optional transit evidence.
  onPhase?.("chart");
  const [profile, , , natalChartRaw, intakeRow] = await Promise.all([
    prisma.birthProfile.findUnique({ where: { userId } }),
    skipCredits
      ? Promise.resolve(undefined)
      : assertHasUsageBudget(userId),
    skipCredits ? Promise.resolve(undefined) : assertWithinUsageLimits(userId),
    requireReadyNatalChart(userId),
    prisma.userIntake.findUnique({
      where: { userId },
      select: { answers: true },
    }),
  ]);
  if (!profile) throw new AppError("VALIDATION", "Birth profile is required");

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
    const now = new Date();
    const place = {
      country: input.transit?.country ?? natalChart.input.country,
      province: input.transit?.province ?? natalChart.input.province,
      district: input.transit?.district ?? natalChart.input.district,
    };
    try {
      return (
        (await getOrComputeDailyTransit(userId, natalChart, {
          date: now,
          time: bangkokTimeHm(now),
          place,
          skipCache: true,
          scrapeTimeoutMs: 500,
        })) ?? null
      );
    } catch (err) {
      try {
        return (
          (await getOrComputeDailyTransit(userId, natalChart, {
            scrapeTimeoutMs: 500,
          })) ?? null
        );
      } catch (fallbackErr) {
        console.warn(
          "[transit] live fetch failed:",
          err instanceof Error ? err.message : err,
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
        );
        if (mode === "TRANSIT") {
          if (err instanceof AppError) throw err;
          throw new AppError(
            "CHART_NOT_READY",
            err instanceof Error ? err.message : "คำนวณดวงจรไม่สำเร็จ",
          );
        }
        return null;
      }
    }
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
  const [chartMemory, userAiMemory, config, knowledgeDocs] = await Promise.all([
    getOrRefreshChartMemory(userId, natalChart),
    getUserAiMemory(userId, { excludeQuestion: question }),
    resolveConfig(category.id, plan, { preferFast: answerMode === "brief" }),
    prisma.knowledgeDoc.findMany({
      where: { enabled: true },
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
  systemPrompt = `${systemPrompt}\n\n${UNIFIED_CHAT_INSTRUCTION}`;
  if (answerMode === "brief") {
    systemPrompt = `${systemPrompt}\n\n${BRIEF_ANSWER_HINT}`;
  } else if (plan === "FREE") {
    systemPrompt = `${systemPrompt}\n\n${DETAILED_ANSWER_HINT_FREE}`;
  } else {
    systemPrompt = `${systemPrompt}\n\n${DETAILED_ANSWER_HINT_PRO}`;
  }
  if (skipCredits) {
    systemPrompt = `${systemPrompt}\n\n${CATEGORY_INTRO_SYSTEM_HINT}`;
  }
  const intakeAnswers = parseIntakeAnswers(intakeRow?.answers);
  const { conversationHistory, userPrompt } = buildConversationHistory(
    priorMessages ?? [],
    snapshot,
    natalChart,
    question,
    {
      chartMemory,
      categorySlug,
      transitChartJson: transitChart,
      intakeText: intakeAnswers ? formatIntakeForPrompt(intakeAnswers) : null,
      userContextText: formatUserAiMemoryForPrompt(userAiMemory),
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
  const reservationId = skipCredits
    ? null
    : await reserveUsageSlot({
        userId,
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
      timeoutMs: resolveAiTimeoutMs(config.modelId, config.timeoutMs, answerMode),
    };

    const result = onDelta
      ? await streamWithFallback(config.id, aiInput, onDelta, shouldStop)
      : await generateWithFallback(config.id, aiInput);

    // On failure/timeout: release reservation, log failure, DO NOT charge.
    // An explicit stop with no text yet is a cancelled turn — not a provider error.
    if (result.stopped && !result.rawText?.trim()) {
      if (reservationId) await releaseUsageReservation(reservationId);
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
        responseText: "หยุดการทำนายแล้ว (ไม่ถูกหัก usage เพราะยังไม่มีคำตอบ)",
        provider: result.provider,
        modelId: result.modelId,
        creditCost: 0,
        status: "FAILED" as const,
        chartSnapshot: null,
        transitSnapshot: null,
      };
    }

    if (!result.ok || !result.rawText) {
      if (reservationId) await releaseUsageReservation(reservationId);
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
    // Not when the user STOPPED it themselves — they cut it on purpose, so
    // "ran out of room, type เล่าต่อ" would be a lie.
    const responseText =
      result.truncated && !result.stopped
        ? `${result.rawText.trimEnd()}\n\n*คำตอบยาวถึงเพดานของโหมดคำตอบ — พิมพ์ “เล่าต่อ” เพื่อฟังส่วนที่เหลือ*`
        : result.rawText;

    const creditCost = 0;
    // Providers normally return authoritative counts. If a compatible endpoint
    // omits them, meter conservatively from text length instead of making that
    // model accidentally unlimited. The pricingVersion marks the fallback.
    const usageWasEstimated =
      result.usage?.inputTokens == null || result.usage?.outputTokens == null;
    const meteredInputUsage =
      result.usage?.inputTokens ??
      Math.ceil(
        (systemPrompt.length +
          userPrompt.length +
          JSON.stringify(conversationHistory).length) /
          3,
      );
    const meteredOutputUsage =
      result.usage?.outputTokens ?? Math.ceil(result.rawText.length / 3);
    const meteredCachedUsage = result.usage?.cachedTokens ?? 0;
    const estimatedCost = estimateCostUsd(
      result.modelId,
      meteredInputUsage,
      meteredOutputUsage,
      meteredCachedUsage,
    );
    const requestedUsageUnits = skipCredits
      ? 0
      : usageUnitsFromUsd(estimatedCost);

    // Success => persist reading. Metered turns reconcile actual provider cost.
    const reading = await prisma.$transaction(async (tx) => {
      if (!skipCredits) {
        if (!reservationId) {
          throw new AppError("INTERNAL", "Usage reservation missing");
        }
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
          creditCost,
          usageCostUnits: 0,
        },
      });

      let usageCostUnits = 0;
      if (!skipCredits && reservationId) {
        const charge = await deductUsageCost(
          userId,
          requestedUsageUnits,
          {
            type: "AI_USAGE",
            referenceType: "reading",
            referenceId: created.id,
            note: "ใช้ AI วิเคราะห์ดวง",
          },
          tx,
        );
        usageCostUnits = charge.chargedUnits;

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
            inputUsage: meteredInputUsage,
            outputUsage: meteredOutputUsage,
            cachedInputUsage: meteredCachedUsage,
            latencyMs: result.latencyMs,
            firstTokenMs: result.firstTokenMs,
            // The billable row is UPDATED from its reservation, so it never passes
            // through logUsage() — price it here or the one row that actually
            // costs money is the one row with no cost on it. Cache hits are
            // priced at 10%, so this is the true bill, not a list-price guess.
            estimatedCost,
            usageCostUnits,
            pricingVersion: usageWasEstimated
              ? `${AI_PRICING_VERSION}:local-estimate`
              : AI_PRICING_VERSION,
          },
        });
      } else {
        await logUsage(
          {
            userId,
            readingId: created.id,
            provider: result.provider,
            modelId: result.modelId,
            status: "SUCCESS",
            inputUsage: result.usage?.inputTokens,
            outputUsage: result.usage?.outputTokens,
            cachedUsage: result.usage?.cachedTokens,
            latencyMs: result.latencyMs,
          },
          tx,
        );
      }

      if (usageCostUnits === 0) return created;
      return tx.horoscopeReading.update({
        where: { id: created.id },
        data: { usageCostUnits },
      });
    });

    // Meta (summaryLine + follow-up chips) is a second Flash-Lite call. Awaiting
    // it here used to hold the SSE `done` event — and with it the caret, the
    // message actions, and the follow-up chips — hostage for up to its full
    // timeout AFTER the answer had already finished typing. Kick it off and hand
    // the promise back so the route can send `done` now and deliver meta later.
    // Only the streaming path consumes it; the legacy 202 path never ships meta.
    // Natal intros skip chips — the CTA is "go to transit", not another question.
    const metaPromise: Promise<FollowUpMeta> =
      onDelta && !skipCredits
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
    if (reservationId) {
      await releaseUsageReservation(reservationId).catch(() => {});
    }
    throw err;
  }
}
