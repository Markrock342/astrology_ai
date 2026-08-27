"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/components/app/app-data-provider";
import type { MyUsage, UsageLimitsFallback } from "@/types/my-usage";

function buildFallback(
  remainingPercent: number,
  limits?: UsageLimitsFallback,
): MyUsage {
  return {
    balance: remainingPercent,
    usedPercent: Math.max(0, 100 - remainingPercent),
    remainingPercent,
    includedRemainingPercent: remainingPercent,
    purchasedRemainingPercent: 0,
    periodStartedAt: null,
    periodEndsAt: limits?.periodEndsAt ?? null,
    dailyLimit: limits?.dailyLimit ?? null,
    monthlyLimit: limits?.monthlyLimit ?? null,
    usedToday: null,
    usedThisMonth: null,
    history: { items: [], nextCursor: null },
  };
}

/** Loads GET /api/me/usage; falls back to bootstrap balance until BE-E1.3 ships. */
export function useMyUsage(
  fallbackLimits?: UsageLimitsFallback,
  options?: { includeHistory?: boolean },
) {
  const { user } = useAppData();
  const [usage, setUsage] = useState<MyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiReady, setApiReady] = useState(false);
  const includeHistory = options?.includeHistory ?? false;

  const load = useCallback(async () => {
    const remainingPercent =
      user?.usageRemainingPercent ?? fallbackLimits?.remainingPercent ?? 0;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/me/usage?view=${includeHistory ? "full" : "summary"}`,
      );
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: MyUsage;
      } | null;
      if (res.ok && json?.ok && json.data) {
        const data = json.data as Partial<MyUsage>;
        setUsage({
          balance: data.remainingPercent ?? remainingPercent,
          usedPercent: data.usedPercent ?? Math.max(0, 100 - remainingPercent),
          remainingPercent: data.remainingPercent ?? remainingPercent,
          includedRemainingPercent:
            data.includedRemainingPercent ?? remainingPercent,
          purchasedRemainingPercent: data.purchasedRemainingPercent ?? 0,
          periodStartedAt: data.periodStartedAt ?? null,
          periodEndsAt: data.periodEndsAt ?? fallbackLimits?.periodEndsAt ?? null,
          dailyLimit: data.dailyLimit ?? null,
          monthlyLimit: data.monthlyLimit ?? null,
          usedToday: data.usedToday ?? null,
          usedThisMonth: data.usedThisMonth ?? null,
          history: data.history ?? { items: [], nextCursor: null },
        });
        setApiReady(true);
        return;
      }
      setApiReady(false);
      setUsage(buildFallback(remainingPercent, fallbackLimits));
    } catch {
      setApiReady(false);
      setUsage(buildFallback(remainingPercent, fallbackLimits));
    } finally {
      setLoading(false);
    }
  }, [user?.usageRemainingPercent, fallbackLimits, includeHistory]);

  useEffect(() => {
    // Async fetch on mount — setState runs after await inside load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { usage, loading, apiReady, refresh: load };
}
