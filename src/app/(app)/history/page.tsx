"use client";

import Link from "next/link";
import { useAppData } from "@/components/app/app-data-provider";

/** Chat history list (user's own threads). */
export default function HistoryPage() {
  const { threads, loading } = useAppData();

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 pt-16 md:px-10 md:pt-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">ดวงจร</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">ประวัติดวงจร (Transit) ของคุณ</p>

        <div className="mt-6 flex flex-col gap-2">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">กำลังโหลด…</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-[var(--muted-2)]">ยังไม่มีดวงจร</p>
          ) : (
            threads.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?thread=${t.id}${t.categorySlug ? `&cat=${t.categorySlug}` : ""}`}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-2)]"
              >
                <span className="truncate">{t.title}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="shrink-0 text-[var(--muted-2)]"
                >
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
