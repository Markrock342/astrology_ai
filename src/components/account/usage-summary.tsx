"use client";

import { useMyUsage } from "@/hooks/use-my-usage";
import type { UsageLimitsFallback } from "@/types/my-usage";

/**
 * A quota bar the user can act on.
 *
 * It leads with what is LEFT, not what is spent — "เหลือ 3 ครั้ง" answers the
 * question someone actually opens this page with, where "ใช้ไปแล้ว 97/100" makes
 * them do the subtraction. The bar warms toward red as the quota fills so the
 * ceiling is visible before it is hit, not only once it is.
 */
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
  const remaining = Math.max(0, limit - count);
  const pct = limit > 0 ? Math.min(100, (count / limit) * 100) : 0;
  const full = used != null && count >= limit;
  const nearlyFull = !full && pct >= 80;

  const barColor = full
    ? "bg-[var(--danger)]"
    : nearlyFull
      ? "bg-[var(--primary)]/70"
      : "bg-[var(--primary)]";

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        {pending && used == null ? (
          <span className="text-[var(--muted-2)]">กำลังโหลด…</span>
        ) : full ? (
          <span className="font-medium text-[var(--danger)]">ใช้ครบแล้ว</span>
        ) : (
          <span className="text-[var(--foreground)]">
            เหลือ{" "}
            <span className="font-semibold tabular-nums">{remaining}</span>
            <span className="text-[var(--muted-2)]"> / {limit} ครั้ง</span>
          </span>
        )}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={count}
        aria-valuetext={
          pending && used == null
            ? `โควต้า ${limit} ครั้ง`
            : full
              ? `${label} ใช้ครบแล้ว`
              : `${label} เหลือ ${remaining} จาก ${limit} ครั้ง`
        }
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: pending && used == null ? "0%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatHistoryType(type: string): string {
  const map: Record<string, string> = {
    DEDUCT: "ใช้ถามดวง",
    AI_USAGE: "ใช้ถามดวง",
    REFUND: "คืนเครดิต",
    ADMIN_ADD: "แอดมินเพิ่มให้",
    ADMIN_DEDUCT: "แอดมินหัก",
    PROMOTION: "โปรโมชัน",
    PURCHASE: "ซื้อแพ็กเกจ",
  };
  return map[type] ?? type;
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
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
        <div className="h-3 w-20 rounded bg-[var(--surface-2)]" />
        <div className="mt-3 h-9 w-24 rounded bg-[var(--surface-2)]" />
        <div className="mt-6 h-1.5 w-full rounded bg-[var(--surface-2)]" />
        <div className="mt-5 h-1.5 w-full rounded bg-[var(--surface-2)]" />
      </div>
    );
  }

  if (!usage) return null;

  const history = usage.history?.items ?? [];
  const cost = usage.creditCostPerMessage;
  const empty = usage.balance <= 0;

  return (
    <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted-2)]">
            การใช้งาน
          </p>
          <p
            className={`mt-1 text-4xl font-semibold tabular-nums leading-none ${
              empty ? "text-[var(--danger)]" : "text-[var(--primary)]"
            }`}
          >
            {usage.balance}
          </p>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            เครดิตคงเหลือ
            {cost != null && cost > 0 ? (
              <span className="text-[var(--muted-2)]">
                {" "}
                · ถามครั้งละ {cost} เครดิต
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="press-scale shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
        >
          รีเฟรช
        </button>
      </div>

      {empty ? (
        <p className="mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
          เครดิตหมดแล้ว — เติมเครดิตหรืออัปเกรดเป็น Pro เพื่อถามต่อ
        </p>
      ) : null}

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

      {history.length > 0 && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted-2)]">
            ประวัติเครดิตล่าสุด
          </p>
          <ul className="mt-3 space-y-2.5">
            {history.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-[var(--muted)]">
                  {row.note ?? formatHistoryType(row.type)}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="text-[10px] text-[var(--muted-2)]">
                    {formatDay(row.createdAt)}
                  </span>
                  <span
                    className={`w-8 text-right font-medium tabular-nums ${
                      row.amount >= 0
                        ? "text-[var(--secondary-active)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {row.amount >= 0 ? "+" : "−"}
                    {Math.abs(row.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
