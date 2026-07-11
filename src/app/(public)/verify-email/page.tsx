import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center px-6 py-16">
          <p className="text-sm text-[var(--muted)]">กำลังโหลด…</p>
        </main>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
