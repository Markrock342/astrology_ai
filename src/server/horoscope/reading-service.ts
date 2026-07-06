import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getEffectivePlan } from "@/server/user/account-service";
import { deductCredits } from "@/server/credit/credit-service";
import { assertWithinUsageLimits } from "@/server/credit/quota-service";
import { generateWithFallback, resolveConfig } from "@/server/ai/router";
import { buildSystemPrompt, buildUserPrompt } from "@/server/ai/prompt-builder";
import { logUsage } from "@/server/ai/usage-logger";
import { loadChartForUser } from "@/server/horoscope/chart-context";
import { resolvePromptParts } from "@/server/horoscope/prompt-resolver";
import type { BirthProfileSnapshot } from "@/types";

/**
 * Orchestrates the reading flow (spec 5.6). Enforces the four hard rules:
 *   - permission + quota checked BEFORE any AI call
 *   - AI failure/timeout => NO credit charged
 *   - retry / double-click => idempotencyKey returns the existing reading
 *   - credit deduction + reading + usage log committed in ONE transaction
 *
 * Steps 1-6 run outside the DB transaction (checks + AI call). Only after a
 * validated success do we open the transaction to charge + persist (step 7).
 */

export type CreateReadingInput = {
  userId: string;
  categorySlug: string;
  question: string;
  idempotencyKey?: string;
};

export async function createReading(input: CreateReadingInput) {
  const { userId, categorySlug, question, idempotencyKey } = input;

  // 0. Idempotency: if we already produced a reading for this key, return it.
  if (idempotencyKey) {
    const existing = await prisma.horoscopeReading.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing) return existing;
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

  // 4. Quota pre-check (final atomic check happens inside the transaction).
  const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
  if ((wallet?.balance ?? 0) < category.creditCost) {
    throw new AppError("NO_QUOTA", "Not enough credit");
  }

  // 4b. Package daily/monthly usage limits (throws RATE_LIMITED when hit).
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

  // 6. Resolve config + prompt, then call AI (no charge yet).
  // Prompt priority: category-specific template > config template > default.
  const config = await resolveConfig(category.id, plan);
  const templateId = category.promptTemplateId ?? config.promptTemplateId;

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

  const chartJson = await loadChartForUser(userId);

  const systemPrompt = buildSystemPrompt({
    ...promptParts,
    knowledge,
  });
  const userPrompt = buildUserPrompt(snapshot, question, chartJson);

  const result = await generateWithFallback(config.id, { systemPrompt, userPrompt });

  // 6b. On failure/timeout: log usage, DO NOT charge, surface a typed error.
  if (!result.ok || !result.rawText) {
    await logUsage({
      userId,
      provider: result.provider,
      modelId: result.modelId,
      status: result.errorCode === "TIMEOUT" ? "TIMEOUT" : "FAILED",
      latencyMs: result.latencyMs,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    const code = result.errorCode === "TIMEOUT" ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR";
    throw new AppError(code, result.errorMessage ?? "AI request failed");
  }

  // 7. Success => single transaction: deduct credit + save reading + usage log.
  const reading = await prisma.$transaction(async (tx) => {
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

    await logUsage(
      {
        readingId: created.id,
        userId,
        provider: result.provider,
        modelId: result.modelId,
        status: "SUCCESS",
        inputUsage: result.usage?.inputTokens,
        outputUsage: result.usage?.outputTokens,
        latencyMs: result.latencyMs,
      },
      tx,
    );

    return created;
  });

  return reading;
}
