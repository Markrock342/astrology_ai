import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyUsage, getMyUsageSummary } from "@/server/account/usage-service";

const mocks = vi.hoisted(() => ({
  getUsageBudgetSnapshot: vi.fn(),
  getUsageCounts: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/server/usage/usage-budget-service", () => ({
  getUsageBudgetSnapshot: mocks.getUsageBudgetSnapshot,
  percentageOf: (part: number, whole: number) =>
    whole <= 0 ? 0 : Math.round((part / whole) * 1_000) / 10,
}));

vi.mock("@/server/credit/quota-service", () => ({
  getUsageCounts: mocks.getUsageCounts,
}));

vi.mock("@/server/db", () => ({
  prisma: {
    usageTransaction: { findMany: mocks.findMany },
  },
}));

describe("getMyUsage cost-weighted contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUsageBudgetSnapshot.mockResolvedValue({
      allowanceUnits: 1_000,
      remainingUnits: 680,
      usedUnits: 320,
      usedPercent: 32,
      remainingPercent: 68,
      includedRemainingPercent: 60,
      purchasedRemainingPercent: 100,
      periodStartedAt: new Date("2026-08-01T00:00:00.000Z"),
      periodEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    mocks.getUsageCounts.mockResolvedValue({
      dailyLimit: null,
      monthlyLimit: null,
      usedToday: 3,
      usedThisMonth: 41,
    });
    mocks.findMany.mockResolvedValue([
      {
        id: "txn-1",
        amountUnits: -7,
        type: "AI_USAGE",
        note: "ใช้ AI วิเคราะห์ดวง",
        referenceType: "reading",
        referenceId: "r-1",
        createdAt: new Date("2026-08-20T00:00:00.000Z"),
      },
    ]);
  });

  it("returns one percentage across models and tokens", async () => {
    const result = await getMyUsage("user-1");
    expect(result).toMatchObject({
      balance: 68,
      usedPercent: 32,
      remainingPercent: 68,
      periodEndsAt: "2026-09-01T00:00:00.000Z",
      history: {
        items: [
          expect.objectContaining({
            id: "txn-1",
            amountPercent: -0.7,
            type: "AI_USAGE",
          }),
        ],
        nextCursor: null,
      },
    });
  });

  it("passes cursor to history query", async () => {
    await getMyUsage("user-1", "txn-prev");
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "txn-prev" }, skip: 1 }),
    );
  });

  it("summary skips ledger history", async () => {
    const result = await getMyUsageSummary("user-1");
    expect(result).toMatchObject({ remainingPercent: 68, usedPercent: 32 });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
