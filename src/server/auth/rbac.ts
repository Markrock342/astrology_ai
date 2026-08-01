import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { assertAdmin2faVerified } from "@/server/auth/admin-2fa-service";

export type SessionUser = {
  id: string;
  role: Role;
  status: string;
  email?: string | null;
  name?: string | null;
};

/**
 * Require an authenticated, active user. Throws AppError otherwise.
 *
 * Role and status are re-read from the DB, NOT trusted from the JWT: NextAuth's
 * token holds up to 30 days, so a user disabled or an admin demoted mid-session
 * would otherwise keep their old role/status (and full API access) until the
 * token expired. One indexed PK read per request is the price of revoking
 * access immediately.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const token = session?.user as SessionUser | undefined;
  if (!token?.id) throw new AppError("UNAUTHENTICATED", "Please sign in");

  const fresh = await prisma.user.findUnique({
    where: { id: token.id },
    select: { id: true, role: true, status: true, email: true, name: true },
  });
  // Deleted mid-session → treat as signed out.
  if (!fresh) throw new AppError("UNAUTHENTICATED", "Please sign in");
  if (fresh.status === "DISABLED") {
    throw new AppError("USER_DISABLED", "This account is disabled");
  }
  return {
    id: fresh.id,
    role: fresh.role,
    status: fresh.status,
    email: fresh.email,
    name: fresh.name,
  };
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
