import { vi } from "vitest";
import type { Prisma } from "@prisma/client";

/** Minimal transaction client for credit-service unit tests. */
export function createMockTx(overrides?: {
  wallet?: { userId: string; balance: number; version: number };
}) {
  const wallet = overrides?.wallet ?? { userId: "user-1", balance: 5, version: 0 };

  const tx = {
    creditWallet: {
      findUnique: vi.fn().mockResolvedValue(wallet),
      create: vi.fn().mockResolvedValue(wallet),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({ ...wallet, balance: wallet.balance - 1 }),
    },
    creditTransaction: {
      create: vi.fn().mockResolvedValue({ id: "txn-1" }),
    },
    horoscopeReading: {
      create: vi.fn().mockResolvedValue({
        id: "reading-1",
        responseText: "คำตอบ",
        creditCost: 1,
        status: "SUCCESS",
      }),
    },
    aIUsageLog: {
      create: vi.fn().mockResolvedValue({ id: "log-1" }),
    },
  };

  return tx as unknown as Prisma.TransactionClient & typeof tx;
}
