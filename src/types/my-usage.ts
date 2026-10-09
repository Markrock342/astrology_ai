/** Contract for GET /api/me/usage (BE-E1.3) — FE-E1.1 */

export type UsageHistoryItem = {
  id: string;
  amountPercent: number;
  /** The row in questions; older servers did not send it. */
  amountQuestions?: number;
  type: string;
  note: string | null;
  createdAt: string;
};

export type MyUsage = {
  /** @deprecated Compatibility alias; now equals remainingPercent. */
  balance: number;
  usedPercent: number;
  remainingPercent: number;
  /** About how many questions are left (server estimate). */
  remainingQuestions?: number;
  /** When bought questions end; null = never or none bought. */
  purchasedExpiresAt?: string | null;
  includedRemainingPercent: number;
  purchasedRemainingPercent: number;
  periodStartedAt: string | null;
  periodEndsAt: string | null;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  /** null while API is unavailable or still loading counts */
  usedToday: number | null;
  usedThisMonth: number | null;
  history?: {
    items: UsageHistoryItem[];
    nextCursor: string | null;
  };
};

export type UsageLimitsFallback = {
  remainingPercent?: number;
  periodEndsAt?: string | null;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
};
