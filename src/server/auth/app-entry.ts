import { getBirthProfile } from "@/server/user/birth-profile-service";

export type AppEntryPath = "/dashboard" | "/onboarding" | "/onboarding/survey";

/**
 * Post-auth entry: birth profile, then straight into the chat. The survey is
 * optional context now — asking ten questions before anyone had seen a reading
 * lost people who just wanted to ask something.
 */
export async function resolveAppEntryPath(userId: string): Promise<AppEntryPath> {
  const profile = await getBirthProfile(userId);
  if (!profile) return "/onboarding";
  return "/dashboard";
}
