import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import {
  estimateCostUsd,
  hasKnownPricing,
  usdToThb,
  USD_TO_THB,
} from "@/config/ai-pricing";
import { bangkokBoundaries } from "@/server/credit/quota-service";

/**
 * What each user actually costs to serve, against what they actually pay.
 *
 * The question this exists to answer is "is 199฿ for 100 readings profitable?",
 * and until now nobody could: ai_usage_logs recorded the tokens but never priced
 * them, so every cost the admin panel showed was blank. See costOf() for how a
 * row is valued.
 *
 * Two rows per turn hit the log: the billable reading (readingId set) and the
 * unbilled Flash-Lite call for the summary/follow-up chips (readingId null).
 * BOTH cost money, so both are counted here. Only the first consumes quota.
 */

export type UserCostRow = {
  userId: string;
  email: string;
  name: string | null;
  plan: "FREE" | "PRO";
  packageName: string | null;
  /** Baht the user pays for the current period (0 for Free). */
  revenueThb: number;
  /** Billable readings — what the user perceives as "ครั้ง". */
  readings: number;
  /** Every AI call we paid for, including the unbilled meta calls. */
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Cost of one reading, in USD. Null when the user made none. */
  costPerReadingUsd: number | null;
  /** Any call on a model we have no list price for — the cost is a guess. */
  hasUnpricedModel: boolean;
};

export type CostSummary = {
  periodStart: string;
  periodLabel: string;
  usdToThb: number;
  totals: {
    users: number;
    payingUsers: number;
    readings: number;
    aiCalls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    revenueThb: number;
    /** Users whose AI cost exceeds what they pay. */
    unprofitableUsers: number;
  };
  rows: UserCostRow[];
};

type LogRow = {
  userId: string;
  modelId: string;
  readingId: string | null;
  inputUsage: number | null;
  outputUsage: number | null;
  estimatedCost: Prisma.Decimal | null;
};

/**
 * The stored cost is authoritative: it was priced when the call happened, at the
 * rate in force then, and it already reflects any cache discount (which we can
 * see at call time but have nowhere to persist). Rows written before cost
 * tracking existed have NULL — those fall back to list price, which is an upper
 * bound, never a free lunch.
 */
function costOf(log: LogRow): number {
  if (log.estimatedCost != null) return Number(log.estimatedCost);
  return estimateCostUsd(log.modelId, log.inputUsage, log.outputUsage);
}

/**
 * @param months 0 = this Bangkok month, 1 = also include last month, etc.
 */
export async function getCostSummary(months = 0): Promise<CostSummary> {
  const now = new Date();
  const { monthStart } = bangkokBoundaries(now);
  const periodStart = new Date(monthStart);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - months);

  const [logs, users] = await Promise.all([
    prisma.aIUsageLog.findMany({
      where: { status: "SUCCESS", createdAt: { gte: periodStart } },
      select: {
        userId: true,
        modelId: true,
        readingId: true,
        inputUsage: true,
        outputUsage: true,
        estimatedCost: true,
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        subscriptions: {
          where: {
            status: "ACTIVE",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { package: { select: { name: true, price: true, type: true } } },
        },
      },
    }),
  ]);

  const byUser = new Map<string, LogRow[]>();
  for (const log of logs) {
    const list = byUser.get(log.userId);
    if (list) list.push(log);
    else byUser.set(log.userId, [log]);
  }

  const rows: UserCostRow[] = [];

  for (const user of users) {
    const userLogs = byUser.get(user.id) ?? [];
    // Skip users with no activity this period — the table is about spend.
    if (userLogs.length === 0) continue;
    rows.push(buildRow(user, userLogs));
  }

  // Most expensive first — that is who threatens the margin.
  rows.sort((a, b) => b.costUsd - a.costUsd);

  const totals = rows.reduce(
    (acc, r) => {
      acc.readings += r.readings;
      acc.aiCalls += r.aiCalls;
      acc.inputTokens += r.inputTokens;
      acc.outputTokens += r.outputTokens;
      acc.costUsd += r.costUsd;
      acc.revenueThb += r.revenueThb;
      if (r.revenueThb > 0) acc.payingUsers += 1;
      if (usdToThb(r.costUsd) > r.revenueThb) acc.unprofitableUsers += 1;
      return acc;
    },
    {
      users: rows.length,
      payingUsers: 0,
      readings: 0,
      aiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      revenueThb: 0,
      unprofitableUsers: 0,
    },
  );

  return {
    periodStart: periodStart.toISOString(),
    periodLabel: months === 0 ? "เดือนนี้" : `${months + 1} เดือนล่าสุด`,
    usdToThb: USD_TO_THB,
    totals,
    rows,
  };
}

/**
 * The same numbers for ONE user — powers the card on the user detail page.
 * Queries just that user rather than summarising everybody and filtering.
 */
export async function getUserCost(userId: string): Promise<UserCostRow | null> {
  const now = new Date();
  const { monthStart } = bangkokBoundaries(now);

  const [logs, user] = await Promise.all([
    prisma.aIUsageLog.findMany({
      where: { userId, status: "SUCCESS", createdAt: { gte: monthStart } },
      select: {
        userId: true,
        modelId: true,
        readingId: true,
        inputUsage: true,
        outputUsage: true,
        estimatedCost: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptions: {
          where: {
            status: "ACTIVE",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { package: { select: { name: true, price: true, type: true } } },
        },
      },
    }),
  ]);

  if (!user) return null;
  return buildRow(user, logs);
}

function buildRow(
  user: {
    id: string;
    email: string;
    name: string | null;
    subscriptions: Array<{
      package: { name: string; price: number; type: string };
    }>;
  },
  userLogs: LogRow[],
): UserCostRow {
  const sub = user.subscriptions[0];
  const isPro = sub?.package.type === "PRO";

  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let readings = 0;
  let hasUnpricedModel = false;

  for (const log of userLogs) {
    inputTokens += log.inputUsage ?? 0;
    outputTokens += log.outputUsage ?? 0;
    costUsd += costOf(log);
    if (log.readingId) readings += 1;
    if (!hasKnownPricing(log.modelId)) hasUnpricedModel = true;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    plan: isPro ? "PRO" : "FREE",
    packageName: sub?.package.name ?? null,
    revenueThb: isPro ? (sub?.package.price ?? 0) : 0,
    readings,
    aiCalls: userLogs.length,
    inputTokens,
    outputTokens,
    costUsd,
    costPerReadingUsd: readings > 0 ? costUsd / readings : null,
    hasUnpricedModel,
  };
}
