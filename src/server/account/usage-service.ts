import { prisma } from "@/server/db";
import { getBalance } from "@/server/credit/credit-service";
import { getUsageCounts } from "@/server/credit/quota-service";

export type UsageHistoryItem = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
};

export type MyUsageResult = {
  balance: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usedToday: number;
  usedThisMonth: number;
  history: {
    items: UsageHistoryItem[];
    nextCursor: string | null;
  };
};

export type MyUsageSummary = {
  balance: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usedToday: number;
  usedThisMonth: number;
};

const HISTORY_PAGE_SIZE = 20;

/** Balance + quota counts only (chat bar / header). */
export async function getMyUsageSummary(userId: string): Promise<MyUsageSummary> {
  const [balance, usage] = await Promise.all([
    getBalance(userId),
    getUsageCounts(userId),
  ]);
  return {
    balance,
    dailyLimit: usage.dailyLimit,
    monthlyLimit: usage.monthlyLimit,
    usedToday: usage.usedToday,
    usedThisMonth: usage.usedThisMonth,
  };
}

/** GET /api/me/usage — balance, plan limits, and paginated credit ledger. */
export async function getMyUsage(
  userId: string,
  cursor?: string,
): Promise<MyUsageResult> {
  const [balance, usage, rows] = await Promise.all([
    getBalance(userId),
    getUsageCounts(userId),
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        amount: true,
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
    balance,
    dailyLimit: usage.dailyLimit,
    monthlyLimit: usage.monthlyLimit,
    usedToday: usage.usedToday,
    usedThisMonth: usage.usedThisMonth,
    history: {
      items: page.map((row) => ({
        id: row.id,
        amount: row.amount,
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
