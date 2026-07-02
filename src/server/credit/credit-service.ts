import type { Prisma, CreditTxnType } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

/**
 * Credit / quota service. All balance changes go through here so the rules in
 * spec 6.7 hold:
 *   - atomic deduction
 *   - never charge a failed AI response
 *   - never double-charge on retry (idempotency handled by the reading service)
 *   - immutable transaction history (append-only ledger)
 *
 * Every mutation writes BOTH the wallet update and a CreditTransaction row
 * inside a single DB transaction, and uses an optimistic-lock `version` bump to
 * guard against concurrent deductions.
 */

export type LedgerRef = {
  type: CreditTxnType;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdByAdminId?: string;
};

async function ensureWallet(userId: string, tx: Prisma.TransactionClient) {
  const wallet = await tx.creditWallet.findUnique({ where: { userId } });
  if (wallet) return wallet;
  return tx.creditWallet.create({ data: { userId, balance: 0, version: 0 } });
}

/**
 * Deduct credits atomically. Intended to be called INSIDE the reading
 * transaction, after a successful AI response. Throws NO_QUOTA if the balance
 * is insufficient. The optimistic `version` check makes concurrent deductions
 * safe: if two requests race, the second retries against fresh state.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  ref: LedgerRef,
  tx: Prisma.TransactionClient,
): Promise<{ balance: number }> {
  if (amount <= 0) throw new AppError("VALIDATION", "amount must be positive");

  const wallet = await ensureWallet(userId, tx);
  if (wallet.balance < amount) {
    throw new AppError("NO_QUOTA", "Not enough credit");
  }

  const updated = await tx.creditWallet.updateMany({
    where: { userId, version: wallet.version },
    data: { balance: { decrement: amount }, version: { increment: 1 } },
  });

  // Concurrent write won the race; caller should retry the whole operation.
  if (updated.count === 0) {
    throw new AppError("INTERNAL", "Concurrent credit update, please retry");
  }

  await tx.creditTransaction.create({
    data: {
      userId,
      amount: -amount,
      type: ref.type,
      referenceType: ref.referenceType,
      referenceId: ref.referenceId,
      note: ref.note,
      createdByAdminId: ref.createdByAdminId,
    },
  });

  return { balance: wallet.balance - amount };
}

/** Add credits (admin add, grant, refund, renewal, promotion). */
export async function addCredits(
  userId: string,
  amount: number,
  ref: LedgerRef,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ balance: number }> {
  if (amount <= 0) throw new AppError("VALIDATION", "amount must be positive");

  const run = async (tx: Prisma.TransactionClient) => {
    const wallet = await ensureWallet(userId, tx);
    const result = await tx.creditWallet.update({
      where: { userId },
      data: { balance: { increment: amount }, version: { increment: 1 } },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        type: ref.type,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        note: ref.note,
        createdByAdminId: ref.createdByAdminId,
      },
    });
    void wallet;
    return { balance: result.balance };
  };

  // Reuse the caller's transaction if provided, otherwise open a new one.
  return "$transaction" in client
    ? (client as typeof prisma).$transaction(run)
    : run(client as Prisma.TransactionClient);
}

export async function getBalance(userId: string): Promise<number> {
  const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
  return wallet?.balance ?? 0;
}
