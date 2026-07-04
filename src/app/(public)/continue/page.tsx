import { redirect } from "next/navigation";
import { resolveAppEntryPath } from "@/server/auth/app-entry";
import { requireSessionUserId } from "@/server/auth/session-guard";

export const dynamic = "force-dynamic";

/** Post sign-in/register/OAuth — send the user to onboarding or chat in one hop. */
export default async function ContinuePage() {
  const userId = await requireSessionUserId();
  redirect(await resolveAppEntryPath(userId));
}
