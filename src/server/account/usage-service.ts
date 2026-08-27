import { prisma } from "@/server/db";
import { getUsageCounts } from "@/server/credit/quota-service";
import {
  getUsageBudgetSnapshot,
  percentageOf,
} from "@/server/usage/usage-budget-service";

export type UsageHistoryItem = {
  id: string;
  amountPercent: number;
  type: string;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type MyUsageSummary = {
  /** Compatibility alias for older clients; now means remaining percentage. */
  balance: number;
  usedPercent: number;
  remainingPercent: number;
  includedRemainingPercent: number;
  purchasedRemainingPercent: number;
  periodStartedAt: string | null;
  periodEndsAt: string | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usedToday: number;
  usedThisMonth: number;
};

export type MyUsageResult = MyUsageSummary & {
  history: {
    items: UsageHistoryItem[];
    nextCursor: string | null;
  };
};

const HISTORY_PAGE_SIZE = 20;

function serializeSummary(
  budget: Awaited<ReturnType<typeof getUsageBudgetSnapshot>>,
  counts: Awaited<ReturnType<typeof getUsageCounts>>,
): MyUsageSummary {
  return {
    balance: budget.remainingPercent,
    usedPercent: budget.usedPercent,
    remainingPercent: budget.remainingPercent,
    includedRemainingPercent: budget.includedRemainingPercent,
    purchasedRemainingPercent: budget.purchasedRemainingPercent,
    periodStartedAt: budget.periodStartedAt?.toISOString() ?? null,
    periodEndsAt: budget.periodEndsAt?.toISOString() ?? null,
    dailyLimit: counts.dailyLimit,
    monthlyLimit: counts.monthlyLimit,
    usedToday: counts.usedToday,
    usedThisMonth: counts.usedThisMonth,
  };
}

/** Cost-weighted usage percentage + request-count safety limits. */
export async function getMyUsageSummary(userId: string): Promise<MyUsageSummary> {
  const [budget, counts] = await Promise.all([
    getUsageBudgetSnapshot(userId),
    getUsageCounts(userId),
  ]);
  return serializeSummary(budget, counts);
}

/** GET /api/me/usage — current percentage plus paginated usage ledger. */
export async function getMyUsage(
  userId: string,
  cursor?: string,
): Promise<MyUsageResult> {
  const [budget, counts, rows] = await Promise.all([
    getUsageBudgetSnapshot(userId),
    getUsageCounts(userId),
    prisma.usageTransaction.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        amountUnits: true,
        type: true,
        note: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
      },
    }),
  ]);

  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;
  return {
    ...serializeSummary(budget, counts),
    history: {
      items: page.map((row) => ({
        id: row.id,
        amountPercent:
          Math.sign(row.amountUnits) *
          percentageOf(Math.abs(row.amountUnits), budget.allowanceUnits),
        type: row.type,
        note: row.note,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    },
  };
}
