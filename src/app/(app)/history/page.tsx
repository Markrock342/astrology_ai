import Link from "next/link";
import { MOCK_THREADS } from "@/components/app/nav-data";

/**
 * Chat history list (user's own threads).
 * TODO(backend): load from GET /api/conversations.
 */
export default function HistoryPage() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          ประวัติการสนทนา
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          บทสนทนาย้อนหลังของคุณ
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {MOCK_THREADS.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard?thread=${t.id}`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--surface-2)]"
            >
              <span className="truncate">{t.title}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--muted-2)]">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
