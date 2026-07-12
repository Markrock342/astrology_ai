import type { AIProvider, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { lockWalletForUpdate } from "@/server/credit/credit-service";

/**
 * Package-level usage limits (Package.dailyLimit / monthlyLimit). Counts
 * successful + in-flight RESERVED AI usages in the current Bangkok day/month.
 * Credit balance is enforced separately by credit-service (NO_QUOTA).
 */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** RESERVED rows older than this are treated as stale (crash mid-request). */
const RESERVATION_TTL_MS = 5 * 60 * 1000;

const QUOTA_COUNT_STATUSES = ["SUCCESS", "RESERVED"] as const;

export function bangkokBoundaries(now = new Date()) {
  const bkk = new Date(now.getTime() + BKK_OFFSET_MS);
  const dayStart = new Date(
    Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - BKK_OFFSET_MS,
  );
  const monthStart = new Date(
    Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - BKK_OFFSET_MS,
  );
  return { dayStart, monthStart };
}

export type PackageLimits = {
  dailyLimit: number | null;
  monthlyLimit: number | null;
};

export async function getActivePackageLimits(
  userId: string,
  now: Date,
  tx: Prisma.TransactionClient = prisma,
): Promise<PackageLimits> {
  const sub = await tx.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { package: { select: { dailyLimit: true, monthlyLimit: true } } },
  });
  if (sub) return sub.package;

  const freePkg = await tx.package.findFirst({
    where: { type: "FREE", enabled: true },
    select: { dailyLimit: true, monthlyLimit: true },
  });
  return freePkg ?? { dailyLimit: null, monthlyLimit: null };
}

type UsageCountRow = { used_today: bigint; used_month: bigint };

/** One index scan for both daily and monthly SUCCESS usage (display API). */
async function countSuccessfulUsage(
  userId: string,
  dayStart: Date,
  monthStart: Date,
  tx: Prisma.TransactionClient = prisma,
): Promise<{ usedToday: number; usedThisMonth: number }> {
  const rows = await tx.$queryRaw<UsageCountRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE "createdAt" >= ${dayStart} AND status = 'SUCCESS')::bigint AS used_today,
      COUNT(*) FILTER (WHERE status = 'SUCCESS')::bigint AS used_month
    FROM ai_usage_logs
    WHERE "userId" = ${userId}
      AND "createdAt" >= ${monthStart}
  `;
  const row = rows[0];
  return {
    usedToday: Number(row?.used_today ?? 0),
    usedThisMonth: Number(row?.used_month ?? 0),
  };
}

async function countQuotaUsageSince(
  userId: string,
  since: Date,
  tx: Prisma.TransactionClient,
): Promise<number> {
  return tx.aIUsageLog.count({
    where: {
      userId,
      status: { in: [...QUOTA_COUNT_STATUSES] },
      createdAt: { gte: since },
    },
  });
}

function throwIfLimitReached(
  used: number,
  limit: number,
  periodLabel: "รายวัน" | "รายเดือน",
): void {
  if (used >= limit) {
    throw new AppError(
      "QUOTA_EXCEEDED",
      `ใช้ครบโควต้า${periodLabel}แล้ว (${limit} ครั้ง/${periodLabel === "รายวัน" ? "วัน" : "เดือน"}) กรุณาลองใหม่ภายหลัง`,
    );
  }
}

async function purgeStaleReservations(
  userId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);
  await tx.aIUsageLog.deleteMany({
    where: { userId, status: "RESERVED", createdAt: { lt: cutoff } },
  });
}

/** Fast path before heavy work (authoritative gate is reserveUsageSlot). */
export async function assertWithinUsageLimits(userId: string): Promise<void> {
  await assertWithinUsageLimitsInTx(userId, prisma);
}

/**
 * Atomic quota check — counts SUCCESS + RESERVED so concurrent requests cannot
 * both pass when only one slot remains.
 */
export async function assertWithinUsageLimitsInTx(
  userId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const now = new Date();
  const limits = await getActivePackageLimits(userId, now, tx);
  if (limits.dailyLimit == null && limits.monthlyLimit == null) return;

  const { dayStart, monthStart } = bangkokBoundaries(now);

  if (limits.dailyLimit != null) {
    const usedToday = await countQuotaUsageSince(userId, dayStart, tx);
    throwIfLimitReached(usedToday, limits.dailyLimit, "รายวัน");
  }

  if (limits.monthlyLimit != null) {
    const usedMonth = await countQuotaUsageSince(userId, monthStart, tx);
    throwIfLimitReached(usedMonth, limits.monthlyLimit, "รายเดือน");
  }
}

export type UsageSnapshot = {
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usedToday: number;
  usedThisMonth: number;
};

/** Counts for GET /api/me/usage (SUCCESS only — RESERVED is in-flight). */
export async function getUsageCounts(userId: string): Promise<UsageSnapshot> {
  const now = new Date();
  const limits = await getActivePackageLimits(userId, now);
  const { dayStart, monthStart } = bangkokBoundaries(now);
  const { usedToday, usedThisMonth } = await countSuccessfulUsage(
    userId,
    dayStart,
    monthStart,
  );

  return {
    dailyLimit: limits.dailyLimit,
    monthlyLimit: limits.monthlyLimit,
    usedToday,
    usedThisMonth,
  };
}

export type ReserveUsageInput = {
  userId: string;
  creditCost: number;
  provider: AIProvider;
  modelId: string;
};

/**
 * Reserve a quota slot + verify balance under row lock BEFORE calling AI.
 * Prevents concurrent requests from both invoking Gemini when one slot remains.
 */
export async function reserveUsageSlot(input: ReserveUsageInput): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await purgeStaleReservations(input.userId, tx);
    const wallet = await lockWalletForUpdate(input.userId, tx);
    await assertWithinUsageLimitsInTx(input.userId, tx);

    if (wallet.balance < input.creditCost) {
      throw new AppError("NO_QUOTA", "Not enough credit");
    }

    const log = await tx.aIUsageLog.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        modelId: input.modelId,
        status: "RESERVED",
      },
      select: { id: true },
    });
    return log.id;
  });
}

/** Release a reservation when AI fails or the request is abandoned. */
export async function releaseUsageReservation(reservationId: string): Promise<void> {
  await prisma.aIUsageLog.deleteMany({
    where: { id: reservationId, status: "RESERVED" },
  });
}
