import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

/**
 * Package-level usage limits (Package.dailyLimit / monthlyLimit). Counts
 * successful AI usages in the current Bangkok day/month and throws RATE_LIMITED
 * when the user's active package limit is reached. Credit balance is enforced
 * separately by credit-service (NO_QUOTA).
 */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bangkokBoundaries(now = new Date()) {
  const bkk = new Date(now.getTime() + BKK_OFFSET_MS);
  const dayStart = new Date(
    Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate()) - BKK_OFFSET_MS,
  );
  const monthStart = new Date(
    Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - BKK_OFFSET_MS,
  );
  return { dayStart, monthStart };
}

async function getActivePackageLimits(userId: string, now: Date) {
  const sub = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { package: { select: { dailyLimit: true, monthlyLimit: true } } },
  });
  if (sub) return sub.package;

  // No subscription row => implicit Free plan; use the default FREE package.
  const freePkg = await prisma.package.findFirst({
    where: { type: "FREE", enabled: true },
    select: { dailyLimit: true, monthlyLimit: true },
  });
  return freePkg ?? { dailyLimit: null, monthlyLimit: null };
}

/** Throws RATE_LIMITED when the package daily/monthly usage limit is reached. */
export async function assertWithinUsageLimits(userId: string): Promise<void> {
  const now = new Date();
  const limits = await getActivePackageLimits(userId, now);
  if (limits.dailyLimit == null && limits.monthlyLimit == null) return;

  const { dayStart, monthStart } = bangkokBoundaries(now);

  if (limits.dailyLimit != null) {
    const usedToday = await prisma.aIUsageLog.count({
      where: { userId, status: "SUCCESS", createdAt: { gte: dayStart } },
    });
    if (usedToday >= limits.dailyLimit) {
      throw new AppError(
        "RATE_LIMITED",
        `ใช้ครบโควต้ารายวันแล้ว (${limits.dailyLimit} ครั้ง/วัน) กรุณาลองใหม่พรุ่งนี้`,
      );
    }
  }

  if (limits.monthlyLimit != null) {
    const usedMonth = await prisma.aIUsageLog.count({
      where: { userId, status: "SUCCESS", createdAt: { gte: monthStart } },
    });
    if (usedMonth >= limits.monthlyLimit) {
      throw new AppError(
        "RATE_LIMITED",
        `ใช้ครบโควต้ารายเดือนแล้ว (${limits.monthlyLimit} ครั้ง/เดือน)`,
      );
    }
  }
}
