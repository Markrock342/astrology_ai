import { prisma } from "@/server/db";

/**
 * Aggregated stats for the admin dashboard (GET /api/admin/dashboard).
 * Read-only — no audit needed. Day/month boundaries use Asia/Bangkok (UTC+7).
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
  const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { dayStart, monthStart, weekStart };
}

export async function getDashboardStats() {
  const now = new Date();
  const { dayStart, monthStart, weekStart } = bangkokBoundaries(now);

  const [
    totalUsers,
    activeUsers,
    newUsersWeek,
    proSubs,
    aiToday,
    aiErrorsToday,
    aiMonth,
    creditsUsedMonth,
    walletTotal,
    pendingPayments,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.userSubscription.count({
      where: {
        status: "ACTIVE",
        package: { type: "PRO" },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.aIUsageLog.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.aIUsageLog.count({
      where: { createdAt: { gte: dayStart }, status: { not: "SUCCESS" } },
    }),
    prisma.aIUsageLog.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.creditTransaction.aggregate({
      where: { type: "AI_USAGE", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.creditWallet.aggregate({ _sum: { balance: true } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        admin: { select: { email: true, name: true } },
      },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      pro: proSubs,
      newThisWeek: newUsersWeek,
    },
    ai: {
      requestsToday: aiToday,
      errorsToday: aiErrorsToday,
      requestsThisMonth: aiMonth,
    },
    credits: {
      // AI_USAGE amounts are negative in the ledger; report as positive usage.
      usedThisMonth: Math.abs(creditsUsedMonth._sum.amount ?? 0),
      totalBalance: walletTotal._sum.balance ?? 0,
    },
    payments: { pending: pendingPayments },
    recentAudit,
  };
}
