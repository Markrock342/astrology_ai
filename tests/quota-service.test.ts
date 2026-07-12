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
  lockWallet: vi.fn(),
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

vi.mock("@/server/credit/credit-service", () => ({
  lockWalletForUpdate: mocks.lockWallet,
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

  it("throws QUOTA_EXCEEDED when daily limit is reached", async () => {
    mocks.count.mockResolvedValue(3);
    await expect(assertWithinUsageLimits("user-1")).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
    });
  });

  it("skips checks when package has no limits", async () => {
    mocks.findFirstSub.mockResolvedValue({
      package: { dailyLimit: null, monthlyLimit: null },
    });
    await assertWithinUsageLimits("user-1");
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("assertWithinUsageLimitsInTx uses the transaction client", async () => {
    mocks.count.mockResolvedValue(1);
    const tx = {
      userSubscription: { findFirst: mocks.findFirstSub },
      package: { findFirst: mocks.findFirstPkg },
      aIUsageLog: { count: mocks.count },
    };
    await assertWithinUsageLimitsInTx("user-1", tx as never);
    expect(mocks.count).toHaveBeenCalled();
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
    mocks.lockWallet.mockResolvedValue({ balance: 10, version: 1 });
    mocks.create.mockResolvedValue({ id: "res-1" });
  });

  it("creates RESERVED log when balance and quota allow", async () => {
    const id = await reserveUsageSlot({
      userId: "user-1",
      creditCost: 1,
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

  it("throws NO_QUOTA when balance is insufficient", async () => {
    mocks.lockWallet.mockResolvedValue({ balance: 0, version: 1 });
    await expect(
      reserveUsageSlot({
        userId: "user-1",
        creditCost: 5,
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
