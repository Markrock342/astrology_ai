import type { ConversationMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { assertCanRequestReading } from "@/server/horoscope/access-policy";
import { deductCredits, lockWalletForUpdate } from "@/server/credit/credit-service";
import {
  assertWithinUsageLimits,
  releaseUsageReservation,
  reserveUsageSlot,
} from "@/server/credit/quota-service";
import { generateWithFallback, resolveConfig, streamWithFallback } from "@/server/ai/router";
import {
  classifyProviderFailure,
  logProviderAlert,
  providerAlertUserMessage,
} from "@/server/ai/provider-alerts";
import { buildSystemPrompt, buildConversationHistory } from "@/server/ai/prompt-builder";
import type { PriorThreadMessage } from "@/server/ai/prompt-builder";
import { logUsage } from "@/server/ai/usage-logger";
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

export type CreateReadingInput = {
  userId: string;
  categorySlug: string;
  question: string;
  idempotencyKey?: string;
  /** Prior messages in the conversation (oldest first), excluding the new question. */
  priorMessages?: PriorThreadMessage[];
  mode?: ConversationMode;
  transit?: TransitSnapshotInput | null;
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
  const { userId, categorySlug, question, idempotencyKey, priorMessages } = input;
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

  // 4. Fast-fail balance (authoritative check at reserveUsageSlot).
  const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
  if ((wallet?.balance ?? 0) < category.creditCost) {
    throw new AppError("NO_QUOTA", "Not enough credit");
  }

  // 4b. Fast-fail package limits (authoritative gate is reserveUsageSlot).
  await assertWithinUsageLimits(userId);

  // 5. Load birth profile and freeze a snapshot (rule 14).
  const profile = await prisma.birthProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError("VALIDATION", "Birth profile is required");
  const snapshot: BirthProfileSnapshot = {
    nickname: profile.nickname,
    birthDate: profile.birthDate.toISOString(),
    birthTime: profile.birthTime,
    birthTimeKnown: profile.birthTimeKnown,
    gender: profile.gender,
    birthLocation: profile.birthLocation,
    additionalInfo: profile.additionalInfo,
  };

  // 5b. Engine-first gate — never call Gemini without a usable natal chart.
  const natalChart = assertUsableEngineChart(await requireReadyNatalChart(userId));
  const chartMemory = await getOrRefreshChartMemory(userId, natalChart);

  let transitChart: ChartJson | null = null;
  if (mode === "TRANSIT") {
    if (!input.transit?.date) {
      throw new AppError(
        "VALIDATION",
        "โหมดดวงจรต้องระบุวันเวลา/สถานที่สำหรับคำนวณดวงจร",
      );
    }
    try {
      transitChart = await getOrComputeDailyTransit(userId, natalChart, {
        date: input.transit.date,
        time: input.transit.time,
        scrapeTimeoutMs: 800,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : "คำนวณดวงจรไม่สำเร็จ";
      throw new AppError("CHART_NOT_READY", message);
    }
  } else if (questionWantsTodayTransit(question)) {
    // Natal chat asking about "today" — attach cached daily transit (no mode switch).
    try {
      transitChart = await getOrComputeDailyTransit(userId, natalChart, {
        scrapeTimeoutMs: 800,
      });
    } catch (err) {
      console.warn(
        "[transit] daily cache miss failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // 6. Resolve config + prompt, then call AI (no charge yet).
  const config = await resolveConfig(category.id, plan);
  const templateId = category.promptTemplateId ?? config.promptTemplateId;

  // Reserve quota slot + balance under lock BEFORE AI (prevents concurrent over-quota).
  const reservationId = await reserveUsageSlot({
    userId,
    creditCost: category.creditCost,
    provider: config.provider,
    modelId: config.modelId,
  });

  const knowledgeDocs = await prisma.knowledgeDoc.findMany({
    where: { enabled: true, OR: [{ categoryId: category.id }, { categoryId: null }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const knowledge =
    knowledgeDocs.length > 0
      ? "ความรู้อ้างอิง (ใช้ประกอบการตอบ):\n\n" +
        knowledgeDocs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")
      : undefined;

  const promptParts = await resolvePromptParts({
    plan,
    categoryName: category.nameTh,
    categoryDescription: category.description,
    personaTemplateId: templateId,
  });

  const systemPrompt = buildSystemPrompt({
    ...promptParts,
    knowledge,
  });
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
    throw new AppError("CHART_NOT_READY", "Engine chart/memory missing from prompt");
  }
  if (mode === "TRANSIT" && !userPrompt.includes("[transit]")) {
    throw new AppError("CHART_NOT_READY", "Transit engine chart missing from prompt");
  }

  const result = onDelta
    ? await streamWithFallback(
        config.id,
        {
          systemPrompt,
          userPrompt,
          conversationHistory:
            conversationHistory.length > 0 ? conversationHistory : undefined,
        },
        onDelta,
        shouldStop,
      )
    : await generateWithFallback(config.id, {
        systemPrompt,
        userPrompt,
        conversationHistory:
          conversationHistory.length > 0 ? conversationHistory : undefined,
      });

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
    const alert = classifyProviderFailure(result.errorCode, result.errorMessage);
    logProviderAlert(alert, {
      modelId: result.modelId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    const code = result.errorCode === "TIMEOUT" ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR";
    throw new AppError(
      code,
      providerAlertUserMessage(alert) ?? result.errorMessage ?? "AI request failed",
    );
  }

  // Success => charge tx: finalize reservation, deduct credit, persist reading.
  const reading = await prisma.$transaction(async (tx) => {
    await lockWalletForUpdate(userId, tx);

    const reserved = await tx.aIUsageLog.findFirst({
      where: { id: reservationId, userId, status: "RESERVED" },
      select: { id: true },
    });
    if (!reserved) {
      throw new AppError("INTERNAL", "Usage reservation expired — please retry");
    }

    const created = await tx.horoscopeReading.create({
      data: {
        userId,
        idempotencyKey,
        birthProfileSnapshotJson: snapshot as object,
        categoryId: category.id,
        question,
        responseJson: (result.parsed as object | undefined) ?? undefined,
        responseText: result.rawText,
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
        inputUsage: result.usage?.inputTokens,
        outputUsage: result.usage?.outputTokens,
        latencyMs: result.latencyMs,
      },
    });

    return created;
  });

  return {
    ...reading,
    chartSnapshot: natalChart,
    transitSnapshot: transitChart,
  };
}
