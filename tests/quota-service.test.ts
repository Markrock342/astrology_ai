import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertWithinUsageLimits,
  assertWithinUsageLimitsInTx,
  releaseUsageReservation,
  reserveUsageSlot,
} from "@/server/credit/quota-service";

const mocks = vi.hoisted(() => ({
  findFirstSub: vi.fn(),
  findFirstPkg: vi.fn(),
  count: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  lockUsageWallet: vi.fn(),
  assertHasUsageBudget: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    userSubscription: { findFirst: mocks.findFirstSub },
    package: { findFirst: mocks.findFirstPkg },
    aIUsageLog: { count: mocks.count, create: mocks.create, deleteMany: mocks.deleteMany },
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/usage/usage-budget-service", () => ({
  lockUsageWalletForUpdate: mocks.lockUsageWallet,
  assertHasUsageBudget: mocks.assertHasUsageBudget,
}));

describe("assertWithinUsageLimits (Wave E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirstSub.mockResolvedValue({
      package: { dailyLimit: 3, monthlyLimit: null },
    });
  });

  it("passes when usage is below daily limit", async () => {
    mocks.count.mockResolvedValue(2);
    await expect(assertWithinUsageLimits("user-1")).resolves.toBeUndefined();
  });

  it("no longer stops a Free user at the package's message count", async () => {
    // The Free row still says dailyLimit 3; usage (the AI budget) is the only
    // limit now, so a fourth message the same day goes through.
    mocks.count.mockResolvedValue(3);
    await expect(assertWithinUsageLimits("user-1")).resolves.toBeUndefined();
  });

  it("skips checks when package has no limits", async () => {
    mocks.findFirstSub.mockResolvedValue({
      package: { dailyLimit: null, monthlyLimit: null },
    });
    await assertWithinUsageLimits("user-1");
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("assertWithinUsageLimitsInTx counts nothing now that counts are retired", async () => {
    const tx = {
      userSubscription: { findFirst: mocks.findFirstSub },
      package: { findFirst: mocks.findFirstPkg },
      aIUsageLog: { count: mocks.count, deleteMany: vi.fn() },
    };
    await assertWithinUsageLimitsInTx("user-1", tx as never);
    expect(mocks.count).not.toHaveBeenCalled();
  });
});

describe("reserveUsageSlot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        aIUsageLog: {
          deleteMany: mocks.deleteMany.mockResolvedValue({ count: 0 }),
          create: mocks.create,
        },
        userSubscription: { findFirst: mocks.findFirstSub },
        package: { findFirst: mocks.findFirstPkg },
        aIUsageLogCount: mocks.count,
      };
      Object.assign(tx, {
        aIUsageLog: {
          ...tx.aIUsageLog,
          count: mocks.count,
        },
      });
      return fn(tx);
    });
    mocks.findFirstSub.mockResolvedValue({
      package: { dailyLimit: null, monthlyLimit: null },
    });
    mocks.lockUsageWallet.mockResolvedValue({
      includedBalanceUnits: 100,
      purchasedBalanceUnits: 0,
      version: 1,
    });
    mocks.count.mockResolvedValue(0);
    mocks.assertHasUsageBudget.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue({ id: "res-1" });
  });

  it("creates RESERVED log when balance and quota allow", async () => {
    const id = await reserveUsageSlot({
      userId: "user-1",
      provider: "GEMINI",
      modelId: "gemini-2.5-flash",
    });
    expect(id).toBe("res-1");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESERVED", userId: "user-1" }),
      }),
    );
  });

  it("blocks a second in-flight generation from consuming the same tail budget", async () => {
    mocks.count.mockResolvedValue(1);
    await expect(
      reserveUsageSlot({
        userId: "user-1",
        provider: "GEMINI",
        modelId: "gemini-2.5-flash",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("throws NO_QUOTA when usage is exhausted", async () => {
    mocks.assertHasUsageBudget.mockRejectedValue(
      Object.assign(new Error("usage exhausted"), { code: "NO_QUOTA" }),
    );
    await expect(
      reserveUsageSlot({
        userId: "user-1",
        provider: "GEMINI",
        modelId: "gemini-2.5-flash",
      }),
    ).rejects.toMatchObject({ code: "NO_QUOTA" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("releaseUsageReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes only RESERVED rows for the given id", async () => {
    await releaseUsageReservation("res-1");
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: "res-1", status: "RESERVED" },
    });
  });
});
