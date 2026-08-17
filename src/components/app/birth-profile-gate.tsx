"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const ACCOUNT_PATH = "/account";
const BIRTH_PATH = "/onboarding";
const SURVEY_PATH = "/onboarding/survey";

/**
 * Hard gates after sign-in: birth profile, then the signup survey.
 * Account stays reachable so the user can log out or delete.
 */
export function BirthProfileGate({
  hasBirthProfile,
  hasIntake,
  children,
}: {
  hasBirthProfile: boolean;
  hasIntake: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === ACCOUNT_PATH) return;

    if (!hasBirthProfile) {
      if (pathname !== BIRTH_PATH) router.replace(BIRTH_PATH);
      return;
    }

    if (!hasIntake) {
      const allowed = pathname === SURVEY_PATH || pathname === BIRTH_PATH;
      if (!allowed) router.replace(SURVEY_PATH);
    }
  }, [hasBirthProfile, hasIntake, pathname, router]);

  return children;
}
