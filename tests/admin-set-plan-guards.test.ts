import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findPackage: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    package: { findUnique: mocks.findPackage },
    $transaction: mocks.transaction,
  },
}));

import { setUserSubscription } from "@/server/admin/user-admin-service";

// QA 2026-10-04: the admin "set plan" took a top-up package and a past expiry.
describe("admin set plan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({ id: "u1" });
  });

  it("refuses a usage top-up as a plan", async () => {
    mocks.findPackage.mockResolvedValue({ id: "p", code: "CREDIT_TOPUP", type: "PRO", creditOnly: true });
    await expect(
      setUserSubscription("u1", { packageCode: "CREDIT_TOPUP" }, { id: "admin" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses an expiry already past", async () => {
    mocks.findPackage.mockResolvedValue({ id: "p", code: "PRO", type: "PRO", creditOnly: false });
    await expect(
      setUserSubscription("u1", { packageCode: "PRO", expiresAt: new Date("2020-01-01") }, { id: "admin" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
