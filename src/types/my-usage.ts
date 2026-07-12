/** Contract for GET /api/me/usage (BE-E1.3) — FE-E1.1 */

export type UsageHistoryItem = {
  id: string;
  amount: number;
  type: string;
  note: string | null;
  createdAt: string;
};

export type MyUsage = {
  balance: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  /** null while API is unavailable or still loading counts */
  usedToday: number | null;
  usedThisMonth: number | null;
  creditCostPerMessage?: number;
  history?: {
    items: UsageHistoryItem[];
    nextCursor: string | null;
  };
};

export type UsageLimitsFallback = {
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
  creditCostPerMessage?: number;
};
