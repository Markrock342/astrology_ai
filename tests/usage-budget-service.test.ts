import { describe, expect, it, vi } from "vitest";
import {
  deductUsageCost,
  grantIncludedUsage,
  percentageOf,
  usageUnitsFromUsd,
} from "@/server/usage/usage-budget-service";

vi.mock("@/server/db", () => ({ prisma: {} }));

function mockTx(wallet = {
  userId: "user-1",
  includedBalanceUnits: 60,
  includedAllowanceUnits: 100,
  purchasedBalanceUnits: 40,
  purchasedAllowanceUnits: 50,
  version: 2,
}) {
  return {
    usageWallet: {
      findUnique: vi.fn().mockResolvedValue(wallet),
      findUniqueOrThrow: vi.fn().mockResolvedValue(wallet),
      create: vi.fn().mockResolvedValue(wallet),
      update: vi.fn().mockResolvedValue(wallet),
    },
    usageTransaction: {
      create: vi.fn().mockResolvedValue({ id: "usage-txn-1" }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
}

describe("cost-weighted usage budget", () => {
  it("converts provider USD cost to integer micro-units", () => {
    expect(usageUnitsFromUsd(0.0000072)).toBe(8);
    expect(usageUnitsFromUsd(0)).toBe(0);
    expect(percentageOf(32, 100)).toBe(32);
  });

  it("consumes included usage before purchased top-up", async () => {
    const tx = mockTx();
    const result = await deductUsageCost(
      "user-1",
      75,
      { type: "AI_USAGE", referenceType: "reading", referenceId: "r-1" },
      tx as never,
    );

    expect(result).toEqual({ chargedUnits: 75, remainingUnits: 25 });
    expect(tx.usageWallet.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        includedBalanceUnits: { decrement: 60 },
        purchasedBalanceUnits: { decrement: 15 },
        version: { increment: 1 },
      },
    });
    expect(tx.usageTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountUnits: -75, bucket: "MIXED" }),
      }),
    );
  });

  it("caps the active response at the remaining allowance", async () => {
    const tx = mockTx({
      userId: "user-1",
      includedBalanceUnits: 3,
      includedAllowanceUnits: 100,
      purchasedBalanceUnits: 0,
      purchasedAllowanceUnits: 0,
      version: 4,
    });
    await expect(
      deductUsageCost(
        "user-1",
        10,
        { type: "AI_USAGE" },
        tx as never,
      ),
    ).resolves.toEqual({ chargedUnits: 3, remainingUnits: 0 });
  });

  it("resets included monthly usage without touching purchased usage", async () => {
    const tx = mockTx();
    await grantIncludedUsage(
      "user-1",
      200,
      {
        type: "PACKAGE_RENEWAL",
        referenceType: "payment",
        referenceId: "usage:pay-1",
      },
      { startsAt: new Date("2026-09-01"), endsAt: new Date("2026-10-01") },
      tx as never,
    );

    expect(tx.usageWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          includedBalanceUnits: 200,
          includedAllowanceUnits: 200,
        }),
      }),
    );
    const data = tx.usageWallet.update.mock.calls[0]?.[0]?.data;
    expect(data).not.toHaveProperty("purchasedBalanceUnits");
  });
});
