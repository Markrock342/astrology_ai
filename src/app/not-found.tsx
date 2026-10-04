import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";

export const metadata: Metadata = { title: "ไม่พบหน้านี้" };

/** Thai 404 — unmatched URLs used to get Next's English "This page could not be found." */
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <BrandMark size={44} />
      <h1 className="mt-8 text-xl font-semibold text-[var(--foreground)]">ไม่พบหน้านี้</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="press-scale rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
        >
          กลับหน้าแรก
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
        >
          ไปหน้าดูดวง
        </Link>
      </div>
    </main>
  );
}
