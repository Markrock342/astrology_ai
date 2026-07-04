import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveAppEntryPath } from "@/server/auth/app-entry";

export const dynamic = "force-dynamic";

/** Post sign-in/register/OAuth — send the user to onboarding or chat in one hop. */
export default async function ContinuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  redirect(await resolveAppEntryPath(session.user.id));
}
