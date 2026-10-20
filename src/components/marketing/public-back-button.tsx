"use client";

import { useRouter } from "next/navigation";

/** Return to the in-site page the visitor came from; otherwise go home. */
export function PublicBackButton() {
  const router = useRouter();

  function goBack() {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      /* malformed/blocked referrer: use the safe fallback */
    }
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="press-scale absolute left-0 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-xl px-3 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      aria-label="กลับหน้าก่อนหน้า"
    >
      <span aria-hidden>←</span>
      <span className="ml-1 hidden sm:inline">กลับ</span>
    </button>
  );
}
