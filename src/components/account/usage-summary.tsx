"use client";

import { useMyUsage } from "@/hooks/use-my-usage";
import type { UsageLimitsFallback } from "@/types/my-usage";

function UsageMeter({
  label,
  used,
  limit,
  pending,
}: {
  label: string;
  used: number | null;
  limit: number | null;
  pending: boolean;
}) {
  if (limit == null) return null;

  const count = used ?? 0;
  const pct = limit > 0 ? Math.min(100, (count / limit) * 100) : 0;
  const full = used != null && used >= limit;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        <span
          className={
            full
              ? "font-medium text-[var(--danger)]"
              : "text-[var(--foreground)]"
          }
        >
          {pending && used == null
            ? `—/${limit}`
            : `ใช้ไปแล้ว ${count}/${limit}`}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used ?? 0}
        aria-valuetext={
          pending && used == null
            ? `โควต้า ${limit} ครั้ง`
            : `ใช้ไปแล้ว ${count} จาก ${limit}`
        }
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            full ? "bg-[var(--danger)]" : "bg-[var(--primary)]"
          }`}
          style={{ width: pending && used == null ? "0%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatHistoryType(type: string): string {
  const map: Record<string, string> = {
    DEDUCT: "ใช้ถามดวง",
    REFUND: "คืนเครดิต",
    ADMIN_ADD: "แอดมินเพิ่ม",
    ADMIN_DEDUCT: "แอดมินหัก",
    PROMOTION: "โปรโมชัน",
    PURCHASE: "ซื้อแพ็กเกจ",
  };
  return map[type] ?? type;
}

export function UsageSummary({
  fallbackLimits,
}: {
  fallbackLimits?: UsageLimitsFallback;
}) {
  const { usage, loading, apiReady, refresh } = useMyUsage(fallbackLimits);

  if (loading && !usage) {
    return (
      <div className="mt-6 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="h-4 w-32 rounded bg-[var(--surface-2)]" />
        <div className="mt-4 h-2 w-full rounded bg-[var(--surface-2)]" />
      </div>
    );
  }

  if (!usage) return null;

  const history = usage.history?.items ?? [];

  return (
    <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--muted-2)]">การใช้งาน</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            เครดิตคงเหลือ{" "}
            <span className="text-lg font-semibold text-[var(--foreground)]">
              {usage.balance}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
        >
          รีเฟรช
        </button>
      </div>

      <UsageMeter
        label="โควต้าวันนี้"
        used={usage.usedToday}
        limit={usage.dailyLimit}
        pending={!apiReady}
      />
      <UsageMeter
        label="โควต้าเดือนนี้"
        used={usage.usedThisMonth}
        limit={usage.monthlyLimit}
        pending={!apiReady}
      />

      {!apiReady && (
        <p className="mt-3 text-[11px] text-[var(--muted-2)]">
          ตัวเลขการใช้รายวัน/เดือนจะแสดงเมื่อ API พร้อม (BE-E1.3)
        </p>
      )}

      {usage.creditCostPerMessage != null && usage.creditCostPerMessage > 0 && (
        <p className="mt-3 text-xs text-[var(--muted)]">
          แต่ละคำถามใช้{" "}
          <span className="font-medium text-[var(--foreground)]">
            {usage.creditCostPerMessage}
          </span>{" "}
          เครดิต
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            ประวัติเครดิตล่าสุด
          </p>
          <ul className="mt-2 space-y-2">
            {history.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate text-[var(--muted)]">
                  {row.note ?? formatHistoryType(row.type)}
                </span>
                <span
                  className={
                    row.amount >= 0
                      ? "shrink-0 text-[var(--secondary-active)]"
                      : "shrink-0 text-[var(--danger)]"
                  }
                >
                  {row.amount >= 0 ? "+" : ""}
                  {row.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
