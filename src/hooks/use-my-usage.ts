"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULTS } from "@/config/constants";
import { useAppData } from "@/components/app/app-data-provider";
import type { MyUsage, UsageLimitsFallback } from "@/types/my-usage";

function buildFallback(
  balance: number,
  limits?: UsageLimitsFallback,
): MyUsage {
  return {
    balance,
    dailyLimit: limits?.dailyLimit ?? null,
    monthlyLimit: limits?.monthlyLimit ?? null,
    usedToday: null,
    usedThisMonth: null,
    creditCostPerMessage:
      limits?.creditCostPerMessage ?? DEFAULTS.creditCostPerReading,
    history: { items: [], nextCursor: null },
  };
}

/** Loads GET /api/me/usage; falls back to bootstrap balance until BE-E1.3 ships. */
export function useMyUsage(fallbackLimits?: UsageLimitsFallback) {
  const { user } = useAppData();
  const [usage, setUsage] = useState<MyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiReady, setApiReady] = useState(false);

  const load = useCallback(async () => {
    const balance = user?.creditBalance ?? 0;
    setLoading(true);
    try {
      const res = await fetch("/api/me/usage?view=summary");
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: MyUsage;
      } | null;
      if (res.ok && json?.ok && json.data) {
        const data = json.data as Partial<MyUsage>;
        setUsage({
          balance: data.balance ?? balance,
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
      setUsage(buildFallback(balance, fallbackLimits));
    } catch {
      setApiReady(false);
      setUsage(buildFallback(balance, fallbackLimits));
    } finally {
      setLoading(false);
    }
  }, [user?.creditBalance, fallbackLimits]);

  useEffect(() => {
    // Async fetch on mount — setState runs after await inside load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { usage, loading, apiReady, refresh: load };
}
