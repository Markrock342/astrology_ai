"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function AppSegmentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      unstable_retry={unstable_retry}
      homeHref="/dashboard"
      homeLabel="กลับหน้าแชท"
    />
  );
}
