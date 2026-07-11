import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { deductCredits } from "@/server/credit/credit-service";
import { createMockTx } from "./helpers/mock-prisma-tx";

describe("deductCredits (M3 B2)", () => {
  it("deducts balance and writes ledger row", async () => {
    const tx = createMockTx({ wallet: { userId: "user-1", balance: 5, version: 2 } });

    const result = await deductCredits(
      "user-1",
      1,
      { type: "AI_USAGE", referenceType: "reading", referenceId: "r-1" },
      tx,
    );

    expect(result.balance).toBe(4);
    expect(tx.creditWallet.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", version: 2 },
      data: { balance: { decrement: 1 }, version: { increment: 1 } },
    });
    expect(tx.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", amount: -1, type: "AI_USAGE" }),
      }),
    );
  });

  it("throws NO_QUOTA when balance is insufficient", async () => {
    const tx = createMockTx({ wallet: { userId: "user-1", balance: 0, version: 0 } });

    await expect(
      deductCredits("user-1", 1, { type: "AI_USAGE" }, tx),
    ).rejects.toMatchObject({ code: "NO_QUOTA" } satisfies Partial<AppError>);

    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });

  it("throws VALIDATION for non-positive amount", async () => {
    const tx = createMockTx();

    await expect(
      deductCredits("user-1", 0, { type: "AI_USAGE" }, tx),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
