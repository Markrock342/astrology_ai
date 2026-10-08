import type {
  Prisma,
  UsageBucket,
  UsageTxnType,
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";

/** One integer unit is one millionth of a USD of provider cost. */
export const USAGE_UNITS_PER_USD = 1_000_000;

export type UsageLedgerRef = {
  type: UsageTxnType;
  bucket?: UsageBucket;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdByAdminId?: string;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

async function ensureUsageWallet(
  userId: string,
  tx: Prisma.TransactionClient,
) {
  const wallet = await tx.usageWallet.findUnique({ where: { userId } });
  if (wallet) return wallet;
  return tx.usageWallet.create({ data: { userId } });
}

/** Provider USD estimate -> exact integer meter units. */
export function usageUnitsFromUsd(costUsd: number): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return 0;
  return Math.max(1, Math.ceil(costUsd * USAGE_UNITS_PER_USD));
}

export function percentageOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (part / whole) * 100)) * 10) / 10;
}

/** Available pool may exceed 100% after a top-up, so it must not be capped. */
export function availableUsagePercent(
  includedBalanceUnits: number,
  purchasedBalanceUnits: number,
  includedAllowanceUnits: number,
): number {
  if (includedAllowanceUnits <= 0) return 0;
  return (
    Math.round(
      ((includedBalanceUnits + purchasedBalanceUnits) /
        includedAllowanceUnits) *
        1_000,
    ) / 10
  );
}

/** Serialize mutations for a user. Call only inside a DB transaction. */
export async function lockUsageWalletForUpdate(
  userId: string,
  tx: Prisma.TransactionClient,
) {
  await ensureUsageWallet(userId, tx);
  await tx.$executeRaw`SELECT id FROM usage_wallets WHERE "userId" = ${userId} FOR UPDATE`;
  return tx.usageWallet.findUniqueOrThrow({ where: { userId } });
}

async function runInTransaction<T>(
  client: DbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return "$transaction" in client
    ? (client as typeof prisma).$transaction(fn)
    : fn(client as Prisma.TransactionClient);
}

/**
 * Start/reset the included allowance for a package period. Purchased top-ups
 * are deliberately preserved so renewing never destroys separately paid usage.
 */
export async function grantIncludedUsage(
  userId: string,
  amountUnits: number,
  ref: UsageLedgerRef,
  period: { startsAt?: Date | null; endsAt?: Date | null },
  client: DbClient = prisma,
) {
  if (!Number.isInteger(amountUnits) || amountUnits < 0) {
    throw new AppError("VALIDATION", "usage amount must be a non-negative integer");
  }

  return runInTransaction(client, async (tx) => {
    const wallet = await lockUsageWalletForUpdate(userId, tx);
    const delta = amountUnits - wallet.includedBalanceUnits;
    const updated = await tx.usageWallet.update({
      where: { userId },
      data: {
        includedBalanceUnits: amountUnits,
        includedAllowanceUnits: amountUnits,
        periodStartedAt: period.startsAt ?? new Date(),
        periodEndsAt: period.endsAt ?? null,
        version: { increment: 1 },
      },
    });
    await tx.usageTransaction.create({
      data: {
        userId,
        amountUnits: delta,
        type: ref.type,
        bucket: "INCLUDED",
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        note: ref.note,
        createdByAdminId: ref.createdByAdminId,
      },
    });
    return updated;
  });
}

/** Add a separately purchased pool. It survives an included-period reset. */
export async function addPurchasedUsage(
  userId: string,
  amountUnits: number,
  ref: UsageLedgerRef,
  client: DbClient = prisma,
) {
  if (!Number.isInteger(amountUnits) || amountUnits <= 0) {
    throw new AppError("VALIDATION", "usage amount must be a positive integer");
  }
  return runInTransaction(client, async (tx) => {
    await lockUsageWalletForUpdate(userId, tx);
    const updated = await tx.usageWallet.update({
      where: { userId },
      data: {
        purchasedBalanceUnits: { increment: amountUnits },
        purchasedAllowanceUnits: { increment: amountUnits },
        version: { increment: 1 },
      },
    });
    await tx.usageTransaction.create({
      data: {
        userId,
        amountUnits,
        type: ref.type,
        bucket: "PURCHASED",
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        note: ref.note,
        createdByAdminId: ref.createdByAdminId,
      },
    });
    return updated;
  });
}

/**
 * The included (package) pool ends with its period. Nothing read periodEndsAt,
 * so a Pro budget outlived the plan: an expired or cancelled Pro user — and
 * everyone after the free-Pro promotion — kept spending a full Pro budget as
 * Free. At period end the pool drops to what the Free package gives (keeping
 * less if less is left) and becomes open-ended, like a Free sign-up's.
 * Purchased usage is untouched; a grant with no end never lapses. Logged as an
 * ADMIN_DEDUCT with a note, the closest existing ledger type.
 */
export async function lapseExpiredIncludedUsage(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  now = new Date(),
): Promise<void> {
  const wallet = await client.usageWallet.findUnique({
    where: { userId },
    select: { includedBalanceUnits: true, periodEndsAt: true },
  });
  if (!wallet?.periodEndsAt || wallet.periodEndsAt > now) return;
  // A paid or admin-given Pro that is still running outlives a period set by
  // something else — the September promotion set every wallet's period to end
  // 1 Oct, and paying Pro users were dropped to the Free budget the next day
  // while still shown as Pro. The period follows that Pro instead.
  const runningPro = await client.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      package: { type: "PRO" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { expiresAt: { sort: "desc", nulls: "first" } },
    select: { expiresAt: true },
  });
  if (runningPro) {
    await client.usageWallet.updateMany({
      where: { userId, periodEndsAt: wallet.periodEndsAt },
      data: { periodEndsAt: runningPro.expiresAt },
    });
    return;
  }
  const free = await client.package.findFirst({
    where: { code: "FREE" },
    select: { usageBudgetUnits: true },
  });
  const cap = Math.max(0, free?.usageBudgetUnits ?? 0);
  const keep = Math.min(Math.max(0, wallet.includedBalanceUnits), cap);
  const lapsed = await client.usageWallet.updateMany({
    where: { userId, periodEndsAt: wallet.periodEndsAt, includedBalanceUnits: wallet.includedBalanceUnits },
    data: { includedBalanceUnits: keep, includedAllowanceUnits: cap, periodEndsAt: null },
  });
  if (lapsed.count === 0 || keep === wallet.includedBalanceUnits) return;
  await client.usageTransaction.create({
    data: {
      userId,
      amountUnits: keep - wallet.includedBalanceUnits,
      type: "ADMIN_DEDUCT",
      bucket: "INCLUDED",
      referenceType: "period_end",
      referenceId: `lapse:${wallet.periodEndsAt.toISOString()}`,
      note: "รอบ usage ของแพ็กเกจสิ้นสุด — กลับเป็นงบของแพ็กเกจ Free",
    },
  });
}

/** Fast preflight. The active response may finish even if it consumes the tail. */
export async function assertHasUsageBudget(
  userId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await lapseExpiredIncludedUsage(userId, tx);
  const wallet = await tx.usageWallet.findUnique({
    where: { userId },
    select: { includedBalanceUnits: true, purchasedBalanceUnits: true },
  });
  if (
    !wallet ||
    wallet.includedBalanceUnits + wallet.purchasedBalanceUnits <= 0
  ) {
    // Shown in the chat bubble; the box under it carries the button to buy more.
    throw new AppError("NO_QUOTA", "เครดิตการใช้งานของคุณถึงขีดจำกัดแล้ว");
  }
}

/**
 * Reconcile a successful response against actual provider cost. Included usage
 * is consumed first; separately purchased usage is the overflow pool.
 */
export async function deductUsageCost(
  userId: string,
  requestedUnits: number,
  ref: UsageLedgerRef,
  tx: Prisma.TransactionClient,
) {
  if (!Number.isInteger(requestedUnits) || requestedUnits < 0) {
    throw new AppError("VALIDATION", "usage cost must be a non-negative integer");
  }
  const wallet = await lockUsageWalletForUpdate(userId, tx);
  const available =
    wallet.includedBalanceUnits + wallet.purchasedBalanceUnits;
  if (available <= 0) {
    // A concurrent response may have consumed the tail after this request was
    // reserved. Let the already-generated answer finish and charge zero here;
    // the next request is blocked by assertHasUsageBudget.
    return { chargedUnits: 0, remainingUnits: 0 };
  }

  const chargedUnits = Math.min(requestedUnits, available);
  const includedCharge = Math.min(chargedUnits, wallet.includedBalanceUnits);
  const purchasedCharge = chargedUnits - includedCharge;
  await tx.usageWallet.update({
    where: { userId },
    data: {
      includedBalanceUnits: { decrement: includedCharge },
      purchasedBalanceUnits: { decrement: purchasedCharge },
      version: { increment: 1 },
    },
  });
  if (chargedUnits > 0) {
    await tx.usageTransaction.create({
      data: {
        userId,
        amountUnits: -chargedUnits,
        type: ref.type,
        bucket:
          includedCharge > 0 && purchasedCharge > 0
            ? "MIXED"
            : purchasedCharge > 0
              ? "PURCHASED"
              : "INCLUDED",
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        note: ref.note,
        createdByAdminId: ref.createdByAdminId,
      },
    });
  }
  return {
    chargedUnits,
    remainingUnits: available - chargedUnits,
  };
}

export type UsageBudgetSnapshot = {
  allowanceUnits: number;
  remainingUnits: number;
  usedUnits: number;
  usedPercent: number;
  remainingPercent: number;
  includedRemainingPercent: number;
  purchasedRemainingPercent: number;
  periodStartedAt: Date | null;
  periodEndsAt: Date | null;
};

export async function getUsageBudgetSnapshot(
  userId: string,
): Promise<UsageBudgetSnapshot> {
  await lapseExpiredIncludedUsage(userId).catch(() => {});
  const wallet = await prisma.usageWallet.findUnique({ where: { userId } });
  if (!wallet) {
    return {
      allowanceUnits: 0,
      remainingUnits: 0,
      usedUnits: 0,
      usedPercent: 0,
      remainingPercent: 0,
      includedRemainingPercent: 0,
      purchasedRemainingPercent: 0,
      periodStartedAt: null,
      periodEndsAt: null,
    };
  }
  // The package allowance is always the 100% denominator. Purchased units are
  // an additive pool, so they can legitimately make availability exceed 100%.
  const allowanceUnits = wallet.includedAllowanceUnits;
  const remainingUnits =
    wallet.includedBalanceUnits + wallet.purchasedBalanceUnits;
  const usedUnits = Math.max(
    0,
    wallet.includedAllowanceUnits - wallet.includedBalanceUnits,
  );
  return {
    allowanceUnits,
    remainingUnits,
    usedUnits,
    usedPercent: percentageOf(usedUnits, allowanceUnits),
    remainingPercent: availableUsagePercent(
      wallet.includedBalanceUnits,
      wallet.purchasedBalanceUnits,
      wallet.includedAllowanceUnits,
    ),
    includedRemainingPercent: percentageOf(
      wallet.includedBalanceUnits,
      wallet.includedAllowanceUnits,
    ),
    purchasedRemainingPercent:
      wallet.includedAllowanceUnits > 0
        ? Math.round(
            (wallet.purchasedBalanceUnits /
              wallet.includedAllowanceUnits) *
              1_000,
          ) / 10
        : 0,
    periodStartedAt: wallet.periodStartedAt,
    periodEndsAt: wallet.periodEndsAt,
  };
}
