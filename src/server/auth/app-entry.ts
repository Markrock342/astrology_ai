import { getBirthProfile } from "@/server/user/birth-profile-service";

/**
 * Post-auth entry: onboarding when birth profile is missing, otherwise the main
 * chat surface. Used by landing, login, and post sign-in redirects so users
 * don't bounce through extra steps.
 */
export async function resolveAppEntryPath(
  userId: string,
): Promise<"/dashboard" | "/onboarding"> {
  const profile = await getBirthProfile(userId);
  return profile ? "/dashboard" : "/onboarding";
}
