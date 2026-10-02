import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    userSubscription: { findFirst: mocks.findFirst },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ userSubscription: { update: mocks.update }, adminAuditLog: { create: mocks.audit } }),
  },
}));
vi.mock("@/server/app/bootstrap-cache", () => ({ invalidateUserBootstrap: vi.fn() }));

import { cancelActiveSubscription } from "@/server/user/profile-service";

describe("a user cancelling their own Pro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cannot drop a plan an admin gave", async () => {
    mocks.findFirst.mockResolvedValue({ id: "s1", expiresAt: null, activationSource: "ADMIN_MANUAL" });
    await expect(cancelActiveSubscription("u1")).rejects.toMatchObject({ code: "VALIDATION" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cancels a paid plan and records who did it", async () => {
    mocks.findFirst.mockResolvedValue({ id: "s2", expiresAt: new Date(), activationSource: "PAYMENT" });
    await cancelActiveSubscription("u1");
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "s2" }, data: { status: "CANCELLED" } });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "user.subscription.self_cancel", adminUserId: "u1" }) }),
    );
  });
});
