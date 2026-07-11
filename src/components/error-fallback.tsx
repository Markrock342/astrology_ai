"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
 *
 * Retry = hard reload (clears stuck RSC error boundaries).
 * Home = leave this segment for a known-good route.
 */
export function ErrorFallback({
  error,
  unstable_retry,
  homeHref = "/",
  homeLabel = "กลับหน้าแรก",
}: ErrorFallbackProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("[HoraSard]", error.digest ?? error.message);
  }, [error]);

  function handleRetry() {
    // Soft retry alone often re-renders the same failed tree; hard reload
    // recovers from transient DB/CMS failures the user hit on /account.
    if (typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    unstable_retry?.();
  }

  function handleHome() {
    router.replace(homeHref);
  }

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
        <button
          type="button"
          onClick={handleRetry}
          className="press-scale rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
        >
          ลองใหม่
        </button>
        <button
          type="button"
          onClick={handleHome}
          className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
        >
          {homeLabel}
        </button>
        {/* Keep a real link for no-JS / crawlers */}
        <Link href={homeHref} className="sr-only">
          {homeLabel}
        </Link>
      </div>
    </main>
  );
}
