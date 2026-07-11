import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";
import { getMe } from "@/server/user/account-service";
import { getMaintenanceMode } from "@/server/settings/settings-service";

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

export type SessionShell = {
  id: string;
  role: string;
  status: string;
  hasBirthProfile: boolean;
};

/**
 * Lightweight shell check for (app)/layout — one user row, no plan/wallet.
 * Cuts 2–3 DB round-trips on every navigation vs full getMe().
 */
export async function requireSessionShell(): Promise<SessionShell> {
  const userId = await requireSessionUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      birthProfile: { select: { id: true } },
    },
  });
  if (!user) redirect("/login");
  if (user.status === "DISABLED") redirect("/login");
  return {
    id: user.id,
    role: user.role,
    status: user.status,
    hasBirthProfile: Boolean(user.birthProfile),
  };
}

/** Maintenance flag cached ~45s — avoids hitting CMS on every navigation. */
export const getCachedMaintenanceMode = unstable_cache(
  async () => getMaintenanceMode(),
  ["cms-maintenance-mode"],
  { revalidate: 45 },
);
