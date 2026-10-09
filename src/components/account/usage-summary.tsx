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
    REFUND: "คืนคำถาม",
    ADMIN_ADD: "แอดมินเพิ่มให้",
    ADMIN_DEDUCT: "แอดมินปรับลด",
    INITIAL_GRANT: "สิทธิ์ทดลอง",
    PROMOTION: "โปรโมชัน",
    PACKAGE_RENEWAL: "เริ่มรอบแพ็กเกจ",
    TOP_UP: "ซื้อแพ็กคำถาม",
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
  const { usage, loading, refresh } = useMyUsage(fallbackLimits, {
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

  // Questions since 9 Oct 2026 (one answer = one question); an older server
  // without the count still gets the percentage.
  const questions = typeof usage.remainingQuestions === "number" ? usage.remainingQuestions : null;
  const remaining = Math.max(0, usage.remainingPercent);
  const exhausted = questions != null ? questions <= 0 : remaining <= 0;
  const low = !exhausted && (questions != null ? questions <= 3 : remaining <= 20);
  const packEnds = formatResetDate(usage.purchasedExpiresAt ?? null);
  const planEnds = formatResetDate(usage.periodEndsAt);
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
              คำถามคงเหลือ
            </p>
            <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
              <span
                className={`tabular-nums text-3xl ${
                  exhausted ? "text-[var(--danger)]" : "text-[var(--primary)]"
                }`}
              >
                {questions != null ? questions.toLocaleString("th-TH") : `${formatPercent(remaining)}%`}
              </span>
              {questions != null ? <span className="ml-2 text-base font-normal text-[var(--muted)]">คำถาม</span> : null}
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

        <p className="mt-4 max-w-[65ch] text-xs leading-relaxed text-[var(--muted)]">
          ถาม 1 ครั้ง = 1 คำถาม ไม่ว่าคำตอบจะยาวแค่ไหน · หักเฉพาะเมื่อได้คำตอบสำเร็จ
          {packEnds
            ? ` · คำถามที่ซื้อใช้ได้ถึง ${packEnds}`
            : planEnds
              ? ` · ใช้ได้ถึง ${planEnds}`
              : " · ไม่มีวันหมดอายุ"}
        </p>

        {exhausted ? (
          <p className="mt-5 flex items-start gap-2.5 border-t border-[var(--border)] pt-3 text-sm text-[var(--foreground)]">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--danger)]" aria-hidden />
            {isPro ? "คำถามหมดแล้ว — ซื้อแพ็กคำถามด้านล่างเพื่อถามต่อ" : "คำถามทดลองหมดแล้ว — ซื้อแพ็กคำถามด้านล่างเพื่อถามต่อ"}
          </p>
        ) : low ? (
          <p className="mt-5 flex items-start gap-2.5 border-t border-[var(--border)] pt-3 text-sm text-[var(--foreground)]">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
            เหลือคำถามไม่มากแล้ว — ซื้อแพ็กเพิ่มได้ คำถามที่เหลือบวกรวมกัน ไม่หาย
          </p>
        ) : null}
      </div>

      {history.length > 0 ? (
        <details className="group border-t border-[var(--border)] px-5 py-4 sm:px-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] [&::-webkit-details-marker]:hidden">
            <span>ประวัติการใช้คำถาม</span>
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
                  <span className="text-[11px] text-[var(--muted-2)]">
                    {formatDay(row.createdAt)}
                  </span>
                  <span
                    className={`min-w-12 text-right font-medium tabular-nums ${
                      (row.amountQuestions ?? row.amountPercent) >= 0
                        ? "text-[var(--secondary-active)]"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {(row.amountQuestions ?? row.amountPercent) >= 0 ? "+" : "−"}
                    {row.amountQuestions != null
                      ? `${formatPercent(Math.abs(row.amountQuestions))} คำถาม`
                      : `${formatPercent(Math.abs(row.amountPercent))}%`}
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
