import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { assertAdmin2faVerified } from "@/server/auth/admin-2fa-service";

export type SessionUser = {
  id: string;
  role: Role;
  status: string;
  email?: string | null;
  name?: string | null;
};

/** Require an authenticated, active user. Throws AppError otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) throw new AppError("UNAUTHENTICATED", "Please sign in");
  if (user.status === "DISABLED") {
    throw new AppError("USER_DISABLED", "This account is disabled");
  }
  return user;
}

const ADMIN_ROLES: Role[] = ["ADMIN", "SUPER_ADMIN"];

export type RequireAdminOptions = {
  /** Skip TOTP step-up (setup / verify / status endpoints only). */
  skip2fa?: boolean;
};

/** Require an admin (or super admin). Every admin action must call this. */
export async function requireAdmin(
  options?: RequireAdminOptions,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new AppError("FORBIDDEN", "Admin access required");
  }
  if (!options?.skip2fa) {
    await assertAdmin2faVerified(user.id);
  }
  return user;
}

export async function requireSuperAdmin(
  options?: RequireAdminOptions,
): Promise<SessionUser> {
  const user = await requireAdmin(options);
  if (user.role !== "SUPER_ADMIN") {
    throw new AppError("FORBIDDEN", "Super admin access required");
  }
  return user;
}
