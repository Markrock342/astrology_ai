import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin, requireUser } from "@/server/auth/rbac";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  assertAdmin2faVerified: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/server/auth/admin-2fa-service", () => ({
  assertAdmin2faVerified: mocks.assertAdmin2faVerified,
}));

describe("rbac (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertAdmin2faVerified.mockResolvedValue(undefined);
  });

  it("requireUser throws UNAUTHENTICATED when no session", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("requireUser throws USER_DISABLED for disabled accounts", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "u1", role: "USER", status: "DISABLED" },
    });
    await expect(requireUser()).rejects.toMatchObject({ code: "USER_DISABLED" });
  });

  it("requireAdmin throws FORBIDDEN for regular users", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "u1", role: "USER", status: "ACTIVE" },
    });
    await expect(requireAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requireAdmin allows ADMIN role when 2FA verified", async () => {
    const admin = { id: "a1", role: "ADMIN", status: "ACTIVE", email: "a@test.com" };
    mocks.auth.mockResolvedValue({ user: admin });
    await expect(requireAdmin()).resolves.toEqual(admin);
    expect(mocks.assertAdmin2faVerified).toHaveBeenCalledWith("a1");
  });

  it("requireAdmin skip2fa skips TOTP check", async () => {
    const admin = { id: "a1", role: "ADMIN", status: "ACTIVE", email: "a@test.com" };
    mocks.auth.mockResolvedValue({ user: admin });
    await expect(requireAdmin({ skip2fa: true })).resolves.toEqual(admin);
    expect(mocks.assertAdmin2faVerified).not.toHaveBeenCalled();
  });
});
