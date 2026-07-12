import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyUsage, getMyUsageSummary } from "@/server/account/usage-service";

const mocks = vi.hoisted(() => ({
  getBalance: vi.fn(),
  getUsageCounts: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/server/credit/credit-service", () => ({
  getBalance: mocks.getBalance,
}));

vi.mock("@/server/credit/quota-service", () => ({
  getUsageCounts: mocks.getUsageCounts,
}));

vi.mock("@/server/db", () => ({
  prisma: {
    creditTransaction: { findMany: mocks.findMany },
  },
}));

describe("getMyUsage (BE-E1.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBalance.mockResolvedValue(12);
    mocks.getUsageCounts.mockResolvedValue({
      dailyLimit: 20,
      monthlyLimit: null,
      usedToday: 3,
      usedThisMonth: 41,
    });
    mocks.findMany.mockResolvedValue([
      {
        id: "txn-1",
        amount: -1,
        type: "AI_USAGE",
        note: null,
        referenceType: "reading",
        referenceId: "r-1",
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
  });

  it("returns usage contract fields", async () => {
    const result = await getMyUsage("user-1");
    expect(result).toMatchObject({
      balance: 12,
      dailyLimit: 20,
      monthlyLimit: null,
      usedToday: 3,
      usedThisMonth: 41,
      history: {
        items: [
          expect.objectContaining({
            id: "txn-1",
            amount: -1,
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
      expect.objectContaining({
        cursor: { id: "txn-prev" },
        skip: 1,
      }),
    );
  });

  it("getMyUsageSummary skips credit history query", async () => {
    const result = await getMyUsageSummary("user-1");
    expect(result).toMatchObject({
      balance: 12,
      usedToday: 3,
      usedThisMonth: 41,
    });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
