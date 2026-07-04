"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandMark } from "@/components/brand-logo";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  homeHref?: string;
  homeLabel?: string;
};

/**
 * Branded fallback when a route segment throws. Used by error.tsx files so
 * users see a friendly Thai message instead of the generic Vercel error page.
 */
export function ErrorFallback({
  error,
  unstable_retry,
  homeHref = "/",
  homeLabel = "กลับหน้าแรก",
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error("[HoraSard]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <BrandMark size={44} />
      <h1 className="mt-8 text-xl font-semibold text-[var(--foreground)]">
        เกิดข้อผิดพลาดชั่วคราว
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        ระบบไม่สามารถโหลดหน้านี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง
        หรือกลับไปหน้าที่ใช้งานได้
      </p>
      {error.digest ? (
        <p className="mt-4 text-[11px] text-[var(--muted-2)]">
          รหัสอ้างอิง: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {unstable_retry ? (
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="press-scale rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
          >
            ลองใหม่
          </button>
        ) : null}
        <Link
          href={homeHref}
          className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
        >
          {homeLabel}
        </Link>
      </div>
    </main>
  );
}
