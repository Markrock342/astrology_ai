"use client";

import { ErrorFallback } from "@/components/error-fallback";
import "./globals.css";

/** Catches errors in the root layout (error.tsx does not wrap layouts). */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <ErrorFallback error={error} unstable_retry={unstable_retry} />
      </body>
    </html>
  );
}
