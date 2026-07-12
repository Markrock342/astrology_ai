"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useMyUsage } from "@/hooks/use-my-usage";
import { useAppData } from "@/components/app/app-data-provider";
import type { UsageLimitsFallback } from "@/types/my-usage";

export function ChatUsageBar({
  fallbackLimits,
  registerRefresh,
}: {
  fallbackLimits?: UsageLimitsFallback;
  registerRefresh?: (refresh: () => void) => void;
}) {
  const { user } = useAppData();
  const { usage, loading, apiReady, refresh } = useMyUsage(fallbackLimits);

  useEffect(() => {
    registerRefresh?.(refresh);
  }, [registerRefresh, refresh]);

  if (loading && !usage) {
    // Instant paint from bootstrap balance — don't blank the bar while /usage loads.
    if (user) {
      return (
        <div className="flex shrink-0 items-center justify-center border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] text-[var(--muted)] md:px-8">
          <Link href="/account" className="transition hover:text-[var(--primary)]">
            เครดิต{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {user.creditBalance}
            </span>
          </Link>
        </div>
      );
    }
    return null;
  }
  if (!usage) return null;

  const balance = usage.balance;
  const daily =
    apiReady &&
    usage.dailyLimit != null &&
    usage.usedToday != null
      ? `${usage.usedToday}/${usage.dailyLimit} วันนี้`
      : null;

  return (
    <div className="flex shrink-0 items-center justify-center border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[11px] text-[var(--muted)] md:px-8">
      <Link
        href="/account"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 transition hover:text-[var(--primary)]"
      >
        <span>
          เครดิต{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {balance}
          </span>
        </span>
        {daily && (
          <>
            <span className="opacity-40">·</span>
            <span>{daily}</span>
          </>
        )}
      </Link>
    </div>
  );
}
