"use client";

import { useAppData } from "@/components/app/app-data-provider";
import { useMyUsage } from "@/hooks/use-my-usage";
import type { UsageLimitsFallback } from "@/types/my-usage";

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatResetDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatHistoryType(type: string): string {
  const map: Record<string, string> = {
    AI_USAGE: "คำตอบจาก AI",
    REFUND: "คืน usage",
    ADMIN_ADD: "แอดมินเพิ่มให้",
    ADMIN_DEDUCT: "แอดมินปรับลด",
    INITIAL_GRANT: "สิทธิ์ทดลอง",
    PROMOTION: "โปรโมชัน",
    PACKAGE_RENEWAL: "เริ่มรอบแพ็กเกจ",
    TOP_UP: "เติม usage",
    MIGRATION: "ย้ายจากระบบเครดิต",
  };
  return map[type] ?? type;
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  });
}

export function UsageSummary({
  fallbackLimits,
}: {
  fallbackLimits?: UsageLimitsFallback;
}) {
  const { usage, loading, apiReady, refresh } = useMyUsage(fallbackLimits, {
    includeHistory: true,
  });
  const { user } = useAppData();
  const isPro = user?.plan === "PRO";

  if (loading && !usage) {
    return (
      <div className="mt-6 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-6 sm:px-6">
        <div className="h-3 w-24 rounded bg-[var(--surface-2)]" />
        <div className="mt-4 h-9 w-40 rounded bg-[var(--surface-2)]" />
        <div className="mt-6 h-2 w-full rounded bg-[var(--surface-2)]" />
        <div className="mt-4 h-3 w-56 rounded bg-[var(--surface-2)]" />
      </div>
    );
  }
  if (!usage) return null;

  const remaining = Math.max(0, usage.remainingPercent);
  const used = Math.max(0, Math.min(100, usage.usedPercent));
  const resetDate = formatResetDate(usage.periodEndsAt);
  const exhausted = remaining <= 0;
  const low = !exhausted && remaining <= 20;
  const history = usage.history?.items ?? [];

  return (
    <section
      className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      aria-labelledby="usage-heading"
    >
      <div className="px-5 py-6 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              id="usage-heading"
              className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-2)]"
            >
              การใช้งานรอบนี้
            </p>
            <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              เหลือ{` `}
              <span
                className={`tabular-nums ${
                  exhausted
                    ? "text-[var(--danger)]"
                    : low
                      ? "text-[var(--primary)]"
                      : "text-[var(--primary)]"
                }`}
              >
                {formatPercent(remaining)}%
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="min-h-11 shrink-0 rounded-lg px-3 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            อัปเดต
          </button>
        </div>

        <div
          className="mt-5 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
          role="progressbar"
          aria-label="usage ที่ใช้ในรอบนี้"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={used}
          aria-valuetext={`ใช้ไป ${formatPercent(used)} เปอร์เซ็นต์ เหลือ ${formatPercent(remaining)} เปอร์เซ็นต์`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
              exhausted ? "bg-[var(--danger)]" : "bg-[var(--primary)]"
            }`}
            style={{ width: apiReady ? `${used}%` : "0%" }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[var(--muted)]">
            ใช้ไป {formatPercent(used)}%
          </span>
          <span className="text-[var(--muted-2)]">
            {resetDate
              ? `ใช้ก้อนนี้ได้ถึง ${resetDate} · 100% ใหม่เมื่อต่อแพ็กเกจ`
              : "usage ก้อนเดียว ไม่มีรีเซ็ตรายวันหรือรายสัปดาห์"}
          </span>
        </div>

        <p className="mt-5 max-w-[65ch] text-xs leading-relaxed text-[var(--muted)]">
          คำตอบแต่ละครั้งใช้ไม่เท่ากัน ขึ้นอยู่กับความยาว ความละเอียด และโมเดลที่ใช้
          ระบบจะหักเฉพาะเมื่อสร้างคำตอบสำเร็จ
        </p>

        {usage.purchasedRemainingPercent > 0 ? (
          <p className="mt-3 text-xs text-[var(--secondary-active)]">
            ในยอดคงเหลือมี usage ที่เติมแยก {formatPercent(usage.purchasedRemainingPercent)}%
            และจะไม่หายเมื่อต่ออายุแพ็กเกจ
          </p>
        ) : null}

        {exhausted ? (
          <div className="mt-5 rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
            {isPro
              ? "usage รอบนี้หมดแล้ว — เติม usage เพื่อถามต่อ"
              : "usage ทดลองหมดแล้ว — อัปเกรดเป็น Pro เพื่อถามต่อ"}
          </div>
        ) : low ? (
          <div className="mt-5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-3 text-sm text-[var(--foreground)]">
            เหลือ usage ไม่มากแล้ว โหมดกระชับจะช่วยให้ใช้งานได้นานขึ้น
          </div>
        ) : null}
      </div>

      {history.length > 0 ? (
        <details className="group border-t border-[var(--border)] px-5 py-4 sm:px-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] [&::-webkit-details-marker]:hidden">
            <span>ประวัติ usage ล่าสุด</span>
            <span aria-hidden className="text-[var(--primary)] transition group-open:rotate-45">
              +
            </span>
          </summary>
          <ul className="pb-2 pt-3">
            {history.slice(0, 8).map((row) => (
              <li
                key={row.id}
                className="flex min-h-10 items-baseline justify-between gap-4 border-t border-[var(--border)]/60 py-2.5 text-xs first:border-0"
              >
                <span className="min-w-0 truncate text-[var(--muted)]">
                  {row.note ?? formatHistoryType(row.type)}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="text-[10px] text-[var(--muted-2)]">
                    {formatDay(row.createdAt)}
                  </span>
                  <span
                    className={`min-w-12 text-right font-medium tabular-nums ${
                      row.amountPercent >= 0
                        ? "text-[var(--secondary-active)]"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {row.amountPercent >= 0 ? "+" : "−"}
                    {formatPercent(Math.abs(row.amountPercent))}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
