import type { ConversationMode } from "@prisma/client";
import { UNIFIED_CHAT_CATEGORY_SLUG } from "@/lib/question-scope";
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
  AI_UNAVAILABLE_USER_MESSAGE,
  logProviderAlert,
  providerAlertUserMessage,
} from "@/server/ai/provider-alerts";
import {
  buildSystemPrompt,
  buildConversationHistory,
  TIMELINE_RULE,
  PAST_TIMELINE_RULE,
  ANSWER_CONTRACT,
  OVERVIEW_TOPICS_RULE,
  DAY_SCAN_RULE,
  DAY_CHECK_RULE,
  CONTINUE_RULE,
  UNKNOWN_TIME_RULE,
  COMPANION_RULE,
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
  isOverviewQuestion,
} from "@/lib/reading-intent";
import { buildLifeTimelinePrompt } from "@/server/horoscope/life-timeline-service";
import { buildDayScanPrompt } from "@/server/horoscope/day-scan-service";
import { buildCompanionsPrompt } from "@/server/horoscope/companion-service";
import type { Companion } from "@/lib/companions";
import { getOrComputeDailyTransit } from "@/server/horoscope/daily-transit-service";
import { resolvePromptParts } from "@/server/horoscope/prompt-resolver";
import {
  generateFollowUpMeta,
  type FollowUpMeta,
} from "@/server/horoscope/follow-up-suggestions";
import {
  BRIEF_ANSWER_HINT,
  DIRECT_ANSWER_HINT,
  TIMELINE_DIRECT_HINT,
  PAST_TIMELINE_DIRECT_HINT,
  BRIEF_MAX_OUTPUT_TOKENS_FREE,
  BRIEF_MAX_OUTPUT_TOKENS_PRO,
  DETAILED_ANSWER_HINT_FREE,
  DETAILED_ANSWER_HINT_PRO,
  OVERVIEW_ANSWER_HINT_FREE,
  OVERVIEW_ANSWER_HINT_PRO,
  FREE_KNOWLEDGE_MAX_CHARS,
  FREE_MAX_OUTPUT_TOKENS,
  GEMINI_DETAILED_FIRST_TOKEN_MS,
  KNOWLEDGE_MAX_CHARS,
  PRO_MAX_OUTPUT_TOKENS,
  PRO_OVERVIEW_MAX_OUTPUT_TOKENS,
  FREE_OVERVIEW_MAX_OUTPUT_TOKENS,
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
import {
  collectAstrologyStandards,
  DEFAULT_STANDARD_GLOSSARY,
  type StandardGlossaryItem,
} from "@/lib/astrology-standard-glossary";
import { assertQuestionAllowedForPlan } from "@/server/horoscope/question-scope";
import {
  formatUserAiMemoryForPrompt,
  formatUserFactsForPrompt,
  getUserAiMemory,
} from "@/server/user/ai-memory-service";
import { buildKnowledgePromptWithTrace } from "@/server/horoscope/knowledge-retrieval";
import type { ReadingPromptTrace, TracePlanet } from "@/types/reading-trace";
import { findWrongLordClaims } from "@/lib/answer-facts";
import { buildHouseChains } from "@/lib/house-chains";
import { repairScriptGlitches } from "@/server/ai/script-repair";
import { planReading } from "@/lib/reading-plan";
import { findWrongTaksaClaims } from "@/lib/answer-facts";
import { rewriteWrongClaims } from "@/server/ai/fact-repair";
import { leadWithDay } from "@/lib/day-scan";
import { tidyAnswer } from "@/lib/answer-tidy";
import { formatQuestionFocus, questionTopics } from "@/lib/question-topics";
import { computeTransitTaksaByAge } from "@/lib/taksa";

export { buildKnowledgePrompt } from "@/server/horoscope/knowledge-retrieval";

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
  /** Composer-picked วันจร. Conversation stamps must not override a phrase like เดือนหน้า. */
  explicitDate?: Date | string | null;
};

/** Include only admin-authored meanings for standards that occur in this chart. */
export function buildAstrologyStandardsPrompt(
  chart: ChartJson,
  glossary: StandardGlossaryItem[],
  options: { kind?: "natal" | "transit"; label?: string } = {},
): string | undefined {
  const kind = options.kind ?? "natal";
  const standards = collectAstrologyStandards(
    kind === "transit"
      ? chart.myhora?.transitPlanets
      : chart.myhora?.natalPlanets,
    glossary.length > 0 ? glossary : DEFAULT_STANDARD_GLOSSARY,
  );
  if (standards.length === 0) return undefined;
  const chartLabel = options.label ?? (kind === "transit" ? "ดวงจร" : "พื้นดวง");
  return [
    `[astrology_standards:${kind}] ความหมายมาตรฐาน/เกณฑ์ฉบับปัจจุบันจากแอดมินสำหรับ${chartLabel} (ใช้เฉพาะรายการที่พบในตารางนี้)`,
    ...standards.map(
      (item) =>
        `- ${item.term} — ดาวที่พบ: ${item.planets.join(", ")} — ${item.meaning}`,
    ),
  ].join("\n");
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
  overview = false,
): number {
  // Seventeen topics told as prose do not fit the everyday cap; an overview
  // cut off at topic six is worse than a slightly dearer answer. The admin's
  // per-model limit still applies on top.
  const planCap = overview
    ? plan === "PRO"
      ? PRO_OVERVIEW_MAX_OUTPUT_TOKENS
      : FREE_OVERVIEW_MAX_OUTPUT_TOKENS
    : plan === "PRO"
      ? PRO_MAX_OUTPUT_TOKENS
      : FREE_MAX_OUTPUT_TOKENS;
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
  /** Other people read alongside the user (partner, parent…), this answer only. */
  companions?: Companion[];
  /**
   * True when the turn this reading answers is gone — superseded by a newer
   * question, edited, regenerated or deleted. Its row already tells the user
   * "ไม่ถูกหัก usage", so a reading stopped for that reason must not charge.
   */
  isAbandoned?: () => Promise<boolean>;
  /** Rolling summary of the chat beyond the history sent (memory/thread-summary-service). */
  threadSummary?: string | null;
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

/** Knowledge docs kept out of answers (seed ids, prisma/seed-knowledge-myhora.ts). */
const BACKGROUND_KNOWLEDGE_IDS = ["kb-global-foundation", "kb-global-calc-tools"] as const;

/** The category guides that fit a question in the one chat; a relationship question always gets love. */
function guideSlugsFor(question: string, aboutRelationship: boolean): string[] {
  const bySlug: Record<string, string> = {
    "ความรักและคู่ครอง": "love",
    "การงาน": "career",
    "ธุรกิจและการค้า": "career",
    "การเงิน": "finance",
    "โชคลาภ": "fortune",
    "สุขภาพ": "health",
  };
  const slugs = new Set(questionTopics(question).map((t) => bySlug[t.label]).filter((x): x is string => Boolean(x)));
  if (aboutRelationship) slugs.add("love");
  if (!slugs.size && isOverviewQuestion(question)) slugs.add("overview");
  return [...slugs];
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
  // "เล่าต่อ" continues the previous answer: what to compute comes from the
  // question that answer was for. Read on its own, "เล่าต่อ" got no day scan,
  // no transit window, and a new natal reading instead of the rest.
  // What this question is read from — one pure decision (lib/reading-plan),
  // tested on a thousand questions without the model.
  const readingPlan = planReading({
    question,
    priorMessages: (priorMessages ?? []).map((m) => ({ role: m.role, content: m.content })),
    pickedDate: input.transit?.explicitDate ?? null,
    hasCompanions: Boolean(input.companions?.length),
  });
  const { continuing, intentQuestion, explicitDate } = readingPlan;
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

  const transitWindow = readingPlan.transitWindow;
  const transitPlace = {
    country: input.transit?.country ?? natalChart.input.country,
    province: input.transit?.province ?? natalChart.input.province,
    district: input.transit?.district ?? natalChart.input.district,
  };

  async function loadTransitAt(
    when: Date,
    required: boolean,
  ): Promise<ChartJson | null> {
    try {
      return (
        (await getOrComputeDailyTransit(userId, natalChart, {
          date: when,
          time: bangkokTimeHm(when),
          place: transitPlace,
          skipCache: true,
          scrapeTimeoutMs: 500,
        })) ?? null
      );
    } catch (err) {
      try {
        return (
          (await getOrComputeDailyTransit(userId, natalChart, {
            date: when,
            time: bangkokTimeHm(when),
            place: transitPlace,
            scrapeTimeoutMs: 500,
          })) ?? null
        );
      } catch (fallbackErr) {
        console.warn(
          "[transit] live fetch failed:",
          err instanceof Error ? err.message : err,
          fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
        );
        if (required && mode === "TRANSIT") {
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

  // A natal question (no time cue, no picked date) is answered from the birth
  // chart alone: no transit block for the model, no ดวงจร wheel on the answer.
  const wantsTransit = transitWindow.intent === "transit";
  const [transitChart, transitHorizonChart] = await Promise.all([
    wantsTransit ? loadTransitAt(transitWindow.sampleAt, true) : Promise.resolve(null),
    wantsTransit && transitWindow.horizonAt
      ? loadTransitAt(transitWindow.horizonAt, false)
      : Promise.resolve(null),
  ]);
  onCharts?.({
    chartSnapshot: natalChart,
    transitSnapshot: transitChart,
  });

  // Memory phase — chart memory, config, knowledge, prompt assembly.
  onPhase?.("memory");
  // A pinpoint question ("วันไหนดีสุด") is answered short whatever the mode;
  // "เล่าต่อ" asks for more, so it keeps the mode it was given.
  const pinpoint = readingPlan.pinpoint;
  // Brief mode prefers 3.5 Flash (lite only if nothing smarter is enabled).
  const answerMode = pinpoint ? "brief" : (input.answerMode ?? "detailed");
  const [chartMemory, userAiMemory, config, knowledgeDocs, standardRows] = await Promise.all([
    getOrRefreshChartMemory(userId, natalChart),
    getUserAiMemory(userId, {
      excludeQuestion: question,
      currentQuestion: question,
      categorySlug,
    }),
    resolveConfig(category.id, plan, { preferFast: answerMode === "brief" }),
    prisma.knowledgeDoc.findMany({
      where: {
        enabled: true,
        // The one chat sits on "self", whose guide sent every answer to work.
        // It gets the guide of what this question is about instead.
        OR: [
          { categoryId: null },
          categorySlug === UNIFIED_CHAT_CATEGORY_SLUG
            ? { category: { slug: { in: guideSlugsFor(intentQuestion, Boolean(input.companions?.length) || readingPlan.relationship) } } }
            : { categoryId: category.id },
        ],
        // Background on calendars, ayanamsa and tools — for the engine's
        // makers, not for answering; it named outside sources and padded every prompt.
        id: { notIn: [...BACKGROUND_KNOWLEDGE_IDS] },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.astrologyStandardTerm.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: "asc" }, { term: "asc" }],
      select: {
        matchKey: true,
        term: true,
        group: true,
        meaning: true,
      },
    }),
  ]);

  const templateId = category.promptTemplateId ?? config.promptTemplateId;

  // The one chat hangs off the "self" category. Its framing ("คำปรึกษาหมวด
  // ตัวตน") and its guide ("อยู่กัมมะ = นิยามตัวเองด้วยการงาน") led every
  // answer — love, health, money — back to work.
  const unifiedChat = categorySlug === UNIFIED_CHAT_CATEGORY_SLUG;
  const promptParts = await resolvePromptParts({
    plan,
    categoryName: unifiedChat ? "ดูดวงทั่วไป (ตอบตามเรื่องที่ผู้ใช้ถาม)" : category.nameTh,
    categoryDescription: unifiedChat ? null : category.description,
    personaTemplateId: templateId,
  });
  // Put the current category guide first so an oversized global corpus cannot
  // consume the entire prompt budget before the relevant doctrine is reached.
  const scopedKnowledge = [...knowledgeDocs].sort(
    (a, b) =>
      (unifiedChat ? 0 : Number(b.categoryId === category.id) - Number(a.categoryId === category.id)) ||
      a.sortOrder - b.sortOrder,
  );
  const categoryFocus =
    !unifiedChat && categorySlug in chartMemory.categories
      ? chartMemory.categories[
          categorySlug as keyof typeof chartMemory.categories
        ]
      : undefined;
  const standardsInCharts = [
    ...(natalChart.myhora?.natalPlanets ?? []),
    ...(transitChart?.myhora?.transitPlanets ?? []),
    ...(transitHorizonChart?.myhora?.transitPlanets ?? []),
  ]
    .filter((row) => row.rerkStandard)
    .map((row) => `${row.planet} ${row.rerkStandard}`)
    .join("\n");
  const recentUserQuestions = (priorMessages ?? [])
    .filter((message) => message.role === "USER")
    .slice(-3)
    .map((message) => message.content.slice(0, 600))
    .join("\n");
  const retrievalContext = [
    unifiedChat ? null : category.nameTh,
    unifiedChat ? null : category.description,
    `ลัคนา ${chartMemory.lagna}`,
    ...(categoryFocus?.summaryLines ?? []),
    standardsInCharts,
    recentUserQuestions,
  ]
    .filter(Boolean)
    .join("\n");
  const knowledgeBudget = plan === "FREE" ? FREE_KNOWLEDGE_MAX_CHARS : KNOWLEDGE_MAX_CHARS;
  const doctrineTrace = buildKnowledgePromptWithTrace(scopedKnowledge, {
    query: intentQuestion,
    context: retrievalContext,
    categoryId: category.id,
    // Trial depth: Free gets the best-ranked doctrine only (see FREE_TRIAL_DEPTH_PERCENT).
    maxChars: knowledgeBudget,
  });
  const doctrine = doctrineTrace.prompt;
  const glossary: StandardGlossaryItem[] = standardRows.map((row) => ({
    matchKey: row.matchKey,
    term: row.term,
    group: row.group === "เกณฑ์ประกอบ" ? "เกณฑ์ประกอบ" : "มาตรฐานดาว",
    meaning: row.meaning,
  }));
  const natalStandards = buildAstrologyStandardsPrompt(natalChart, glossary);
  const transitStandards = transitChart
    ? buildAstrologyStandardsPrompt(transitChart, glossary, { kind: "transit" })
    : undefined;
  const horizonStandards = transitHorizonChart
    ? buildAstrologyStandardsPrompt(transitHorizonChart, glossary, {
        kind: "transit",
        label: "ดวงจรปลายช่วง",
      })
    : undefined;
  const knowledge = [
    doctrine,
    natalStandards,
    transitStandards,
    horizonStandards,
  ]
    .filter(Boolean)
    .join("\n\n") || undefined;

  // Other people in the question: their charts and what ties them to the user.
  const companionText = input.companions?.length
    ? await buildCompanionsPrompt(natalChart, input.companions)
    : null;

  // "Which day is good for …?" gets every day of the period walked; it takes
  // precedence over the life timeline, which also matches ช่วงไหน/เมื่อไหร่.
  const { dayPick, checkDay } = readingPlan;
  const dayScanText = dayPick
    ? buildDayScanPrompt({
        natal: natalChart,
        memory: chartMemory,
        question: intentQuestion,
        categorySlug,
        pinnedDate: explicitDate ?? null,
        birthTimeKnown: profile.birthTimeKnown,
      })
    : checkDay && !continuing
      ? buildDayScanPrompt({
          natal: natalChart,
          memory: chartMemory,
          question: intentQuestion,
          categorySlug,
          checkDay,
          birthTimeKnown: profile.birthTimeKnown,
        })
      : null;

  // "When will my life turn?" gets the slow planets walked over the years.
  // Past or future, and about whom: decided here from the words and the
  // thread, not left to the model's date arithmetic. "เลิกกันไปแล้ว ฟังนะ
  // เอาใหม่" keeps the time-line question asked just before it, in the past.
  const { pastEvent, timelineQuestion, relationship } = readingPlan;
  const timelineText = !dayScanText && timelineQuestion
    ? buildLifeTimelinePrompt({
        natal: natalChart,
        memory: chartMemory,
        question: timelineQuestion,
        categorySlug,
        past: pastEvent,
        relationship,
        rejectedYears: readingPlan.rejectedYears,
        birthTimeKnown: profile.birthTimeKnown,
      })
    : null;

  // This period's ทักษาจร, named for the model and checked in its answer —
  // graders found one person's answers giving different ทักษาจร. Not for a
  // birth-chart answer, nor a timeline (each year has its own).
  // Not for a day pick or day check either: there a day's role comes from the
  // birth ทักษา ("วันอุตสาหะของคุณ"), and a year's ทักษาจร beside it ("ศรีจร =
  // เสาร์") read as the same Saturday being both bad and good.
  const taksaSlots =
    !timelineText && !dayScanText && transitWindow.intent === "transit"
      ? computeTransitTaksaByAge(natalChart.input, transitWindow.sampleAt).slots.filter((x) => x.planet)
      : null;
  const taksaNowText = taksaSlots?.length
    ? `[taksa_now] ทักษาจรของผู้ถามในช่วงที่ถาม (ใช้ชื่อตามนี้เท่านั้น ห้ามเรียกดาวว่าเป็นทักษาจรอื่น): ${taksaSlots
        .map((x) => `${x.taksa} = ${x.planet}`)
        .join(" · ")}`
    : null;
  // The houses the question is about, by the team's topic table.
  const questionFocusText = profile.birthTimeKnown
    ? formatQuestionFocus(intentQuestion, natalChart.chart?.lagna ?? natalChart.meta.lagna)
    : null;

  // Shown above the answer, so the reader knows what it was read from.
  const pairBasis = companionText && input.companions?.length
    ? `ดวงคู่: ดวงเดิมของคุณ เทียบดวงของ${input.companions.map((c) => c.nickname).join(" และ ")}`
    : null;
  const readFrom = timelineText
    ? pastEvent
      ? "ไทม์ไลน์ชีวิตย้อนหลัง (ดาวจรช่วงที่ผ่านมา เทียบดวงเดิม)"
      : "ไทม์ไลน์ชีวิต (ดาวจรล่วงหน้า เทียบดวงเดิม)"
    : dayScanText && dayPick
      ? `ไล่ดวงจรทีละวัน เทียบดวงเดิม · ${transitWindow.label}`
      : dayScanText
        ? `ดวงจร ${transitWindow.label} เทียบดวงเดิม`
        : transitChart
          ? `ดวงจร ${transitWindow.label} เทียบดวงเดิม`
          : "พื้นดวงเดิม";
  const basis = pairBasis
    ? readFrom === "พื้นดวงเดิม"
      ? pairBasis
      : `${pairBasis} · ${readFrom}`
    : readFrom;

  let systemPrompt = buildSystemPrompt({
    ...promptParts,
    knowledge,
  });
  systemPrompt = `${systemPrompt}\n\n${UNIFIED_CHAT_INSTRUCTION}`;
  if (timelineText) {
    systemPrompt = `${systemPrompt}\n\n${pastEvent ? PAST_TIMELINE_RULE : TIMELINE_RULE}`;
  }
  if (dayScanText) {
    systemPrompt = `${systemPrompt}\n\n${dayPick ? DAY_SCAN_RULE : DAY_CHECK_RULE}`;
  }
  if (continuing) {
    systemPrompt = `${systemPrompt}\n\n${CONTINUE_RULE}`;
  }
  if (!profile.birthTimeKnown) {
    systemPrompt = `${systemPrompt}\n\n${UNKNOWN_TIME_RULE}`;
  }
  if (companionText) {
    systemPrompt = `${systemPrompt}\n\n${COMPANION_RULE}`;
  }
  const overview = isOverviewQuestion(intentQuestion);
  // A past event is one period with reasons, asked directly or not.
  if (pinpoint || (timelineText && pastEvent)) {
    systemPrompt = `${systemPrompt}\n\n${timelineText ? (pastEvent ? PAST_TIMELINE_DIRECT_HINT : TIMELINE_DIRECT_HINT) : DIRECT_ANSWER_HINT}`;
  } else if (answerMode === "brief") {
    systemPrompt = `${systemPrompt}\n\n${BRIEF_ANSWER_HINT}`;
  } else if (overview) {
    systemPrompt = `${systemPrompt}\n\n${OVERVIEW_TOPICS_RULE}\n\n${plan === "FREE" ? OVERVIEW_ANSWER_HINT_FREE : OVERVIEW_ANSWER_HINT_PRO}`;
  } else if (plan === "FREE") {
    systemPrompt = `${systemPrompt}\n\n${DETAILED_ANSWER_HINT_FREE}`;
  } else {
    systemPrompt = `${systemPrompt}\n\n${DETAILED_ANSWER_HINT_PRO}`;
  }
  if (skipCredits) {
    systemPrompt = `${systemPrompt}\n\n${CATEGORY_INTRO_SYSTEM_HINT}`;
  } else if (!continuing) {
    systemPrompt = `${systemPrompt}\n\n${ANSWER_CONTRACT}`;
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
      transitHorizonChartJson: transitHorizonChart,
      transitWindowLabel: transitWindow.label,
      // The date the user confirmed in the modal outranks relative words in
      // the question ("เดือนหน้า" + picked 1 Oct means October, not November).
      transitPickedAt: explicitDate
        ? transitWindow.sampleAt
        : null,
      readingIntent: transitWindow.intent,
      overview: isOverviewQuestion(intentQuestion),
      timelineText,
      dayScanText,
      companionText,
      intakeText: intakeAnswers ? formatIntakeForPrompt(intakeAnswers) : null,
      userContextText: formatUserAiMemoryForPrompt(userAiMemory),
      userFactsText: formatUserFactsForPrompt(userAiMemory),
      questionFocusText,
      taksaNowText,
      threadSummaryText: input.threadSummary ?? null,
    },
  );

  // Final guard: refuse AI if engine table somehow missing from the prompt.
  if (!userPrompt.includes("[natal]") || !userPrompt.includes("[memory]")) {
    throw new AppError(
      "CHART_NOT_READY",
      "Engine chart/memory missing from prompt",
    );
  }
  // Only when this turn actually reads ดวงจร. Every chat is a TRANSIT-mode
  // conversation, but a question with no time cue is answered from the birth
  // chart alone (no transit block by design) — guarding on `mode` here failed
  // every such question with CHART_NOT_READY.
  if (wantsTransit && mode === "TRANSIT" && !userPrompt.includes("[transit]")) {
    throw new AppError(
      "CHART_NOT_READY",
      "Transit engine chart missing from prompt",
    );
  }

  // Frozen with the reading so an admin can see exactly what the model got.
  const tracePlanets = (chart: ChartJson): TracePlanet[] =>
    chart.planets.map((row) => ({ planet: row.planet, sign: row.siderealSign }));
  const promptTrace: ReadingPromptTrace = {
    version: 1,
    createdAt: new Date().toISOString(),
    question,
    answerMode,
    plan,
    intent: transitWindow.intent,
    window: {
      label: transitWindow.label,
      sampleAt: transitWindow.sampleAt.toISOString(),
      horizonAt: transitWindow.horizonAt?.toISOString() ?? null,
      pickedByUser: Boolean(explicitDate),
    },
    natal: {
      lagna: natalChart.chart?.lagna ?? natalChart.meta.lagna ?? "—",
      birthDisplay: natalChart.meta.birthDisplay ?? null,
      source: natalChart.meta.calculationSource ?? null,
      planets: tracePlanets(natalChart),
    },
    transit: transitChart
      ? {
          lagna: transitChart.chart?.lagna ?? transitChart.meta.lagna ?? "—",
          asOf: `${transitChart.input.day}/${transitChart.input.month}/${transitChart.input.year} ${transitChart.input.time}`,
          source: transitChart.meta.calculationSource ?? null,
          planets: tracePlanets(transitChart),
        }
      : null,
    knowledge: {
      budgetChars: knowledgeBudget,
      usedChars: doctrineTrace.usedChars,
      chunks: doctrineTrace.chunks.map((chunk) => ({
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        chars: chunk.content.length,
        score: Math.round(chunk.score * 100) / 100,
        pinned: chunk.pinned ?? false,
      })),
    },
    templates: promptParts.sources ?? { system: null, persona: null, format: null },
    model: null,
    systemPrompt,
    userPrompt,
  };

  // The prompt-level test suite (scripts/eval-1000.ts, EVAL_PROMPTS) audits
  // what the model would be given, without calling it.
  if (process.env.EVAL_CAPTURE_PROMPT === "1") {
    throw Object.assign(new Error("EVAL_PROMPT_CAPTURED"), {
      captured: { systemPrompt, userPrompt, conversationHistory, basis, plan: readingPlan },
    });
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
      isOverviewQuestion(question),
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

    if (result.rawText?.trim() && input.isAbandoned && (await input.isAbandoned())) {
      if (reservationId) await releaseUsageReservation(reservationId);
      await logUsage({
        userId,
        provider: result.provider,
        modelId: result.modelId,
        status: "FAILED",
        latencyMs: result.latencyMs,
        errorCode: "SUPERSEDED",
        errorMessage: "Turn superseded or deleted while streaming",
      });
      return {
        id: "",
        responseText: "ถูกยกเลิกเพราะมีคำถามใหม่ (ไม่ถูกหัก usage)",
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
        result.errorCode === "TIMEOUT"
          ? "AI_TIMEOUT"
          : alert === "BILLING" || alert === "QUOTA"
            ? "AI_CAPACITY"
            : "AI_PROVIDER_ERROR";
      if (!alert) {
        // The raw provider text is for us, not for the customer.
        console.error(
          `[ai] reading failed model=${result.modelId ?? "?"} code=${result.errorCode ?? "?"} ${result.errorMessage ?? ""}`.trim(),
        );
      }
      throw new AppError(
        code,
        providerAlertUserMessage(alert) ?? AI_UNAVAILABLE_USER_MESSAGE,
      );
    }

    // A MAX_TOKENS cut ends mid-sentence with no signal. Surface it honestly so
    // the user knows to ask for the rest, instead of a silently missing ending.
    // Not when the user STOPPED it themselves — they cut it on purpose, so
    // "ran out of room, type เล่าต่อ" would be a lie.
    // A cut connection gets its own wording: "ran out of room" would blame
    // the answer mode for what was a dropped stream.
    // Gemini sometimes drops another script into a Thai word; mend those lines.
    // Gemini sometimes drops another script into a Thai word; mend those lines.
    // Planet digits in brackets ("ดาวพฤหัสบดี (๕)") mean nothing to a reader.
    // Block names, English months and a wrong weekday on a date are fixed in place.
    let cleanText = tidyAnswer(
      (await repairScriptGlitches(result.rawText, userId)).replace(/\s*\([๐-๙]\)/g, ""),
      new Date(),
    );

    // House lords and ทักษาจร checked against the chart. A wrong one is
    // rewritten in place; only what survives the rewrite gets a footnote.
    const chains = buildHouseChains({
      lagna: natalChart.chart?.lagna ?? natalChart.meta.lagna,
      planets: natalChart.planets,
      taksa: natalChart.chart?.taksa,
    });
    const checkFacts = (text: string) => ({
      lords: findWrongLordClaims(text, chains),
      taksa: taksaSlots ? findWrongTaksaClaims(text, taksaSlots) : [],
    });
    let facts = checkFacts(cleanText);
    if (facts.lords.length || facts.taksa.length) {
      console.warn(
        `[answer-facts] ${[
          ...facts.lords.map((i) => `${i.claimed}≠เจ้าเรือน${i.houseName}(${i.actual})`),
          ...facts.taksa.map((i) => `${i.planet}≠${i.claimed}(${i.actual})`),
        ].join(", ")}`,
      );
      cleanText = await rewriteWrongClaims(
        cleanText,
        [
          ...facts.lords.map((i) => ({ excerpt: i.excerpt, truth: `เจ้าเรือน${i.houseName}คือ${i.actual} (ไม่ใช่${i.claimed})` })),
          ...facts.taksa.map((i) => ({ excerpt: i.excerpt, truth: `ในช่วงนี้${i.planet}เป็น${i.actual} (ไม่ใช่${i.claimed})` })),
        ],
        userId,
      );
      facts = checkFacts(cleanText);
    }
    const factIssues = facts.lords;
    // A question about one named day is answered with that day in front.
    if (checkDay && !dayPick && !continuing) cleanText = leadWithDay(cleanText, new Date(checkDay));
    const answerText =
      result.truncated && !result.stopped
        ? result.truncatedBy === "connection"
          ? `${cleanText.trimEnd()}\n\n*การเชื่อมต่อกับระบบ AI ขาดกลางคำตอบ — กด “เล่าต่อ” เพื่อฟังส่วนที่เหลือ*`
          : `${cleanText.trimEnd()}\n\n*คำตอบยาวถึงเพดานของโหมดคำตอบ — พิมพ์ “เล่าต่อ” เพื่อฟังส่วนที่เหลือ*`
        : cleanText;

    const creditCost = 0;
    const leftover = [
      ...facts.lords.map((i) => `เจ้าเรือน${i.houseName}ในดวงของคุณคือ${i.actual} ไม่ใช่${i.claimed}`),
      ...facts.taksa.map((i) => `ช่วงนี้${i.planet}เป็น${i.actual} ไม่ใช่${i.claimed}`),
    ];
    const responseText = leftover.length ? `${answerText.trimEnd()}\n\n*แก้ไข: ${leftover.join(" · ")}*` : answerText;
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
          promptVersion: promptParts.sources?.persona?.version ?? undefined,
          promptTraceJson: {
            ...promptTrace,
            model: { provider: result.provider, modelId: result.modelId },
            factIssues,
          } as object,
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
      // The answer is already paid for and written by now: a slow database
      // (several round trips for the charge and logs) must not throw it away
      // at Prisma's 5-second default.
    }, { maxWait: 10_000, timeout: 20_000 });

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
      basis,
    };
  } catch (err) {
    if (reservationId) {
      await releaseUsageReservation(reservationId).catch(() => {});
    }
    throw err;
  }
}
