"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function PublicSegmentError({
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
      homeHref="/login"
      homeLabel="กลับหน้าเข้าสู่ระบบ"
    />
  );
}
