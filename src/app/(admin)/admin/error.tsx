"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function AdminSegmentError({
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
      homeHref="/admin/dashboard"
      homeLabel="กลับหน้าแอดมิน"
    />
  );
}
