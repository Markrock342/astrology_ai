import type { ConversationMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getEffectivePlan } from "@/server/user/account-service";
import { deductCredits, lockWalletForUpdate } from "@/server/credit/credit-service";
import {
  assertWithinUsageLimits,
  releaseUsageReservation,
  reserveUsageSlot,
} from "@/server/credit/quota-service";
import { generateWithFallback, resolveConfig } from "@/server/ai/router";
import {
  classifyProviderFailure,
  logProviderAlert,
  providerAlertUserMessage,
} from "@/server/ai/provider-alerts";
import { buildSystemPrompt, buildConversationHistory } from "@/server/ai/prompt-builder";
import type { PriorThreadMessage } from "@/server/ai/prompt-builder";
import { logUsage } from "@/server/ai/usage-logger";
import { requireReadyNatalChart } from "@/server/horoscope/chart-context";
import { resolvePromptParts } from "@/server/horoscope/prompt-resolver";
import { computeTransitChart } from "@/server/horoscope/engine/compute-chart";
import type { BirthInputSnapshot, ChartJson } from "@/types/chart";
import type { BirthProfileSnapshot } from "@/types";

/**
 * Orchestrates the reading flow (spec 5.6). Enforces the four hard rules:
 *   - quota slot reserved under lock BEFORE any AI call (SUCCESS + RESERVED count)
 *   - AI failure/timeout => release reservation, NO credit charged
 *   - retry / double-click => idempotencyKey returns the existing reading
 *   - credit deduction + reading + usage finalize committed in ONE transaction
 *
 * Engine-first: natal chart MUST be READY (recompute once) before Gemini.
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

function transitToChartInput(
  transit: TransitSnapshotInput,
  natalFallback: BirthInputSnapshot,
): BirthInputSnapshot {
  const d = transit.date;
  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    time: transit.time?.trim() || "12:00",
    country: transit.country?.trim() || natalFallback.country,
    province: transit.province?.trim() || natalFallback.province,
    district: transit.district?.trim() || natalFallback.district,
  };
}

export async function createReading(input: CreateReadingInput) {
  const { userId, categorySlug, question, idempotencyKey, priorMessages } = input;
  const mode = input.mode ?? "NATAL";

  // 0. Idempotency: if we already produced a reading for this key, return it.
  if (idempotencyKey) {
    const existing = await prisma.horoscopeReading.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing) {
      const natalChart = await requireReadyNatalChart(userId).catch(() => null);
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

  // 3. Flowchart: Free users cannot chat at all; Pro-only categories stay locked for Free.
  const plan = await getEffectivePlan(userId);
  if (plan !== "PRO") {
    throw new AppError(
      "CHAT_REQUIRES_PRO",
      "ต้องอัปเกรดเป็น Pro ก่อนจึงจะสนทนากับ AI ได้",
    );
  }

  if (category.accessLevel === "PRO" && plan !== "PRO") {
    throw new AppError("CATEGORY_LOCKED", "This category is for Pro members");
  }

  if (mode === "TRANSIT" && plan !== "PRO") {
    throw new AppError("TRANSIT_REQUIRES_PRO", "โหมดดวงจรสำหรับสมาชิก Pro");
  }

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

  // 5b. Engine-first gate — never call Gemini without a computed natal chart.
  const natalChart = await requireReadyNatalChart(userId);

  let transitChart: ChartJson | null = null;
  if (mode === "TRANSIT") {
    if (!input.transit?.date) {
      throw new AppError(
        "VALIDATION",
        "โหมดดวงจรต้องระบุวันเวลา/สถานที่สำหรับคำนวณดวงจร",
      );
    }
    const transitInput = transitToChartInput(input.transit, natalChart.input);
    try {
      transitChart = await computeTransitChart(transitInput, natalChart.input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "คำนวณดวงจรไม่สำเร็จ";
      throw new AppError("CHART_NOT_READY", message);
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
    transitChart,
  );

  const result = await generateWithFallback(config.id, {
    systemPrompt,
    userPrompt,
    conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
  });

  // On failure/timeout: release reservation, log failure, DO NOT charge.
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
