"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ACCOUNT_PATH = "/account";
const BIRTH_PATH = "/onboarding";

/**
 * One hard gate after sign-in: the birth profile, which every reading needs.
 * The ten-question survey used to gate the app too, and people bounced off it —
 * it is optional context now, offered from the account page instead.
 * Account stays reachable so the user can log out or delete.
 */
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
    if (pathname === ACCOUNT_PATH) return;

    if (!hasBirthProfile && pathname !== BIRTH_PATH) {
      router.replace(BIRTH_PATH);
    }
  }, [hasBirthProfile, pathname, router]);

  return children;
}
