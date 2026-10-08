import { prisma } from "@/server/db";
import { USD_TO_THB } from "@/config/ai-pricing";
import { getGeminiBalance } from "@/server/admin/gemini-balance-service";

/**
 * Where a top-up went, call by call — asked for by A (8 Oct 2026): "เติม 400
 * บาท ได้กี่ credit, in/out กี่ครั้ง ครั้งละเท่าไร, chat หนึ่งครั้งใช้เฉลี่ยเท่าไร".
 * Google's billing shows daily totals per model only; every call we make is
 * logged here (AIUsageLog), answers and the background calls alike.
 */

/** Our usage unit: 1,000,000 = US$1 of AI cost. */
const UNITS_PER_USD = 1_000_000;

export type CreditReportBucket = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
};

export type CreditReport = {
  since: string;
  sinceTracked: boolean;
  topUpThb: number | null;
  topUpUsd: number | null;
  /** The top-up in our usage units (1,000,000 = $1). */
  topUpUnits: number | null;
  spentThb: number;
  remainingThb: number | null;
  answers: CreditReportBucket;
  background: CreditReportBucket;
  failedCalls: number;
  byModel: Array<CreditReportBucket & { modelId: string }>;
  perAnswer: {
    inputTokens: number;
    outputTokens: number;
    /** The answer's own call only. */
    costThb: number;
    /** Including its share of the background calls (follow-ups, memory …). */
    allInCostThb: number;
    allInUnits: number;
  } | null;
  answersLeft: number | null;
  daily: Array<{ day: string; answers: number; costThb: number }>;
};

const empty = (): CreditReportBucket => ({ calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0 });

function add(b: CreditReportBucket, row: { _count: number; _sum: { inputUsage: number | null; outputUsage: number | null; cachedInputUsage: number | null; estimatedCost: unknown } }) {
  b.calls += row._count;
  b.inputTokens += row._sum.inputUsage ?? 0;
  b.outputTokens += row._sum.outputUsage ?? 0;
  b.cachedTokens += row._sum.cachedInputUsage ?? 0;
  b.costUsd += Number(row._sum.estimatedCost ?? 0);
}

/** Pure part, unit-tested: averages and what is left. */
export function summarizeCreditReport(input: {
  answers: CreditReportBucket;
  background: CreditReportBucket;
  topUpThb: number | null;
  remainingThb: number | null;
}) {
  const { answers, background } = input;
  const totalUsd = answers.costUsd + background.costUsd;
  const perAnswer = answers.calls
    ? {
        inputTokens: Math.round(answers.inputTokens / answers.calls),
        outputTokens: Math.round(answers.outputTokens / answers.calls),
        costThb: (answers.costUsd / answers.calls) * USD_TO_THB,
        allInCostThb: (totalUsd / answers.calls) * USD_TO_THB,
        allInUnits: Math.round((totalUsd / answers.calls) * UNITS_PER_USD),
      }
    : null;
  const answersLeft =
    perAnswer && input.remainingThb != null && perAnswer.allInCostThb > 0
      ? Math.max(0, Math.floor(input.remainingThb / perAnswer.allInCostThb))
      : null;
  const topUpUsd = input.topUpThb != null ? input.topUpThb / USD_TO_THB : null;
  return {
    perAnswer,
    answersLeft,
    topUpUsd,
    topUpUnits: topUpUsd != null ? Math.round(topUpUsd * UNITS_PER_USD) : null,
    spentThb: totalUsd * USD_TO_THB,
  };
}

export async function getCreditReport(): Promise<CreditReport> {
  const balance = await getGeminiBalance();
  const since = balance.recordedAt ? new Date(balance.recordedAt) : (() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  })();

  const grouped = await prisma.aIUsageLog.groupBy({
    by: ["modelId", "status"],
    where: { createdAt: { gte: since } },
    _count: true,
    _sum: { inputUsage: true, outputUsage: true, cachedInputUsage: true, estimatedCost: true },
  });
  const answerRows = await prisma.aIUsageLog.groupBy({
    by: ["modelId"],
    where: { createdAt: { gte: since }, status: "SUCCESS", readingId: { not: null } },
    _count: true,
    _sum: { inputUsage: true, outputUsage: true, cachedInputUsage: true, estimatedCost: true },
  });

  const answers = empty();
  for (const r of answerRows) add(answers, r);
  const allSuccess = empty();
  const byModel = new Map<string, CreditReportBucket>();
  let failedCalls = 0;
  for (const r of grouped) {
    if (r.status === "SUCCESS") {
      add(allSuccess, r);
      const m = byModel.get(r.modelId) ?? empty();
      add(m, r);
      byModel.set(r.modelId, m);
    } else if (r.status !== "RESERVED") {
      failedCalls += r._count;
    }
  }
  const background: CreditReportBucket = {
    calls: allSuccess.calls - answers.calls,
    inputTokens: allSuccess.inputTokens - answers.inputTokens,
    outputTokens: allSuccess.outputTokens - answers.outputTokens,
    cachedTokens: allSuccess.cachedTokens - answers.cachedTokens,
    costUsd: allSuccess.costUsd - answers.costUsd,
  };

  const dailyRows = await prisma.$queryRaw<Array<{ day: string; answers: bigint; cost: number | null }>>`
    SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Bangkok')::date, 'YYYY-MM-DD') AS day,
           COUNT(*) FILTER (WHERE "readingId" IS NOT NULL) AS answers,
           SUM("estimatedCost")::float AS cost
    FROM "ai_usage_logs"
    WHERE "createdAt" >= ${since} AND status = 'SUCCESS'
    GROUP BY 1 ORDER BY 1 DESC LIMIT 14`;

  const summary = summarizeCreditReport({
    answers,
    background,
    topUpThb: balance.topUpThb,
    remainingThb: balance.remainingThb,
  });

  return {
    since: since.toISOString(),
    sinceTracked: Boolean(balance.recordedAt),
    topUpThb: balance.topUpThb,
    topUpUsd: summary.topUpUsd,
    topUpUnits: summary.topUpUnits,
    spentThb: summary.spentThb,
    remainingThb: balance.remainingThb,
    answers,
    background,
    failedCalls,
    byModel: [...byModel.entries()]
      .map(([modelId, b]) => ({ modelId, ...b }))
      .sort((a, b) => b.costUsd - a.costUsd),
    perAnswer: summary.perAnswer,
    answersLeft: summary.answersLeft,
    daily: dailyRows.map((r) => ({ day: r.day, answers: Number(r.answers), costThb: Number(r.cost ?? 0) * USD_TO_THB })),
  };
}
