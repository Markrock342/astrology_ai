import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin, requireUser } from "@/server/auth/rbac";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertAdmin2faVerified: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/server/db", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

vi.mock("@/server/auth/admin-2fa-service", () => ({
  assertAdmin2faVerified: mocks.assertAdmin2faVerified,
}));

/** The DB row requireUser re-reads is the source of truth (not the JWT). */
function dbUser(over: Partial<{ id: string; role: string; status: string; email: string | null; name: string | null }>) {
  return { id: "u1", role: "USER", status: "ACTIVE", email: null, name: null, ...over };
}

describe("rbac (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertAdmin2faVerified.mockResolvedValue(undefined);
  });

  it("requireUser throws UNAUTHENTICATED when no session", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("requireUser throws UNAUTHENTICATED when the user was deleted mid-session", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "USER", status: "ACTIVE" } });
    mocks.findUnique.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("throws USER_DISABLED when the DB status is DISABLED even if the JWT says ACTIVE", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "USER", status: "ACTIVE" } });
    mocks.findUnique.mockResolvedValue(dbUser({ status: "DISABLED" }));
    await expect(requireUser()).rejects.toMatchObject({ code: "USER_DISABLED" });
  });

  it("requireAdmin throws FORBIDDEN when the DB role is USER even if the JWT says ADMIN", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "ADMIN", status: "ACTIVE" } });
    mocks.findUnique.mockResolvedValue(dbUser({ role: "USER" }));
    await expect(requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requireAdmin allows ADMIN role when 2FA verified", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN", status: "ACTIVE" } });
    mocks.findUnique.mockResolvedValue(dbUser({ id: "a1", role: "ADMIN", email: "a@test.com" }));
    await expect(requireAdmin()).resolves.toMatchObject({ id: "a1", role: "ADMIN" });
    expect(mocks.assertAdmin2faVerified).toHaveBeenCalledWith("a1");
  });

  it("requireAdmin skip2fa skips TOTP check", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "a1", role: "ADMIN", status: "ACTIVE" } });
    mocks.findUnique.mockResolvedValue(dbUser({ id: "a1", role: "ADMIN", email: "a@test.com" }));
    await expect(requireAdmin({ skip2fa: true })).resolves.toMatchObject({ id: "a1", role: "ADMIN" });
    expect(mocks.assertAdmin2faVerified).not.toHaveBeenCalled();
  });
});
