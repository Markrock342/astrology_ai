import { getBirthProfile } from "@/server/user/birth-profile-service";
import { hasIntake } from "@/server/user/intake-service";

export type AppEntryPath = "/dashboard" | "/onboarding" | "/onboarding/survey";

/**
 * Post-auth entry: birth profile first, then the signup survey, then chat.
 * Used by landing, login, and post sign-in redirects so users
 * don't bounce through extra steps.
 */
export async function resolveAppEntryPath(userId: string): Promise<AppEntryPath> {
  const profile = await getBirthProfile(userId);
  if (!profile) return "/onboarding";
  if (!(await hasIntake(userId))) return "/onboarding/survey";
  return "/dashboard";
}
