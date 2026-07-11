"use client";

import { Suspense } from "react";
import { AuthCard } from "./auth-card";

function AuthCardFallback() {
  return (
    <div className="h-[480px] w-full max-w-[420px] animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60" />
  );
}

/** Single-card auth with tab switcher (login-first, world-class pattern). */
export function AuthPanels({
  googleEnabled = false,
  consentRegisterLabel,
}: {
  googleEnabled?: boolean;
  consentRegisterLabel?: string;
}) {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <AuthCard
        googleEnabled={googleEnabled}
        consentRegisterLabel={consentRegisterLabel}
      />
    </Suspense>
  );
}
