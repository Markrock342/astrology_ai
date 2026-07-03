"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Redirect first-time users without a birth profile to onboarding. */
export function BirthProfileGate({
  hasBirthProfile,
  children,
}: {
  hasBirthProfile: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (hasBirthProfile) return;
    const allowed = pathname === "/onboarding" || pathname === "/account";
    if (!allowed) router.replace("/onboarding");
  }, [hasBirthProfile, pathname, router]);

  return children;
}
