import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { getMe } from "@/server/user/account-service";

/** Redirect to /login when there is no valid session. */
export async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/**
 * Load the current user for authenticated layouts/pages. Stale or mismatched
 * JWT (e.g. old Google provider id) redirects to login instead of crashing.
 */
export async function requireSessionMe() {
  const userId = await requireSessionUserId();
  try {
    return await getMe(userId);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") redirect("/login");
    throw err;
  }
}
