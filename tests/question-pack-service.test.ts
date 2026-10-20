import { beforeEach, describe, expect, it, vi } from "vitest";

const usageMocks = vi.hoisted(() => ({
  addPurchasedUsage: vi.fn(),
  expirePurchasedUsage: vi.fn(),
}));

vi.mock("@/server/usage/usage-budget-service", () => usageMocks);
vi.mock("@/server/audit/audit-service", () => ({ writeAudit: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));

import { applyQuestionPack } from "@/server/catalog/question-pack-service";

describe("applyQuestionPack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usageMocks.addPurchasedUsage.mockResolvedValue(undefined);
    usageMocks.expirePurchasedUsage.mockResolvedValue(undefined);
  });

  it("adds Lite questions without replacing an existing Plus entitlement", async () => {
    const now = new Date("2026-10-20T05:00:00.000Z");
    const plusEnd = new Date("2026-11-20T05:00:00.000Z");
    const update = vi.fn().mockResolvedValue({
      id: "sub-plus",
      expiresAt: plusEnd,
      package: { code: "PLUS" },
    });
    const create = vi.fn();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      usageWallet: {
        findUnique: vi.fn().mockResolvedValue({ purchasedBalanceUnits: 0, purchasedExpiresAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      userSubscription: {
        findMany: vi.fn().mockResolvedValue([
          { id: "sub-plus", expiresAt: plusEnd, package: { code: "PLUS", questionPack: true } },
        ]),
        update,
        create,
        updateMany,
      },
    };

    const result = await applyQuestionPack(tx as never, {
      userId: "user-1",
      pkg: {
        id: "pkg-lite",
        code: "LITE",
        usageBudgetUnits: 600_000,
        expiryMode: "DAYS",
        expiryDays: 30,
        expiresOn: null,
      },
      ref: { type: "TOP_UP", referenceType: "payment", referenceId: "pay-lite" },
      activationSource: "PAYMENT",
      now,
    });

    expect(result.questionsAdded).toBe(40);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sub-plus" } }));
    expect(create).not.toHaveBeenCalled();
    expect(result.subscription.package.code).toBe("PLUS");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", status: "ACTIVE", id: { not: "sub-plus" } },
    }));
  });

  it("creates the first Pro entitlement when a Free user buys a pack", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "sub-lite",
      expiresAt: null,
      package: { code: "LITE" },
    });
    const tx = {
      appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      usageWallet: {
        findUnique: vi.fn().mockResolvedValue({ purchasedBalanceUnits: 0, purchasedExpiresAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      userSubscription: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        create,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await applyQuestionPack(tx as never, {
      userId: "user-1",
      pkg: {
        id: "pkg-lite",
        code: "LITE",
        usageBudgetUnits: 600_000,
        expiryMode: "NONE",
        expiryDays: null,
        expiresOn: null,
      },
      ref: { type: "TOP_UP", referenceType: "payment", referenceId: "pay-lite" },
      activationSource: "PAYMENT",
      now: new Date("2026-10-20T05:00:00.000Z"),
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ packageId: "pkg-lite", status: "ACTIVE" }),
    }));
  });
});
