import { unstable_cache } from "next/cache";
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

type StatRow = {
  total_users: bigint | number;
  active_users: bigint | number;
  new_users_week: bigint | number;
  pro_subs: bigint | number;
  ai_today: bigint | number;
  ai_errors_today: bigint | number;
  ai_month: bigint | number;
  credits_used_month: bigint | number | null;
  wallet_total: bigint | number | null;
  pending_payments: bigint | number;
};

function n(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "bigint" ? Number(v) : v;
}

async function loadDashboardStats() {
  const now = new Date();
  const { dayStart, monthStart, weekStart } = bangkokBoundaries(now);

  // One round-trip for KPIs (avoids 10 sequential queries under connection_limit=1).
  const [stats] = await prisma.$queryRaw<StatRow[]>`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM users WHERE status = 'ACTIVE') AS active_users,
      (SELECT COUNT(*)::int FROM users WHERE "createdAt" >= ${weekStart}) AS new_users_week,
      (SELECT COUNT(*)::int FROM user_subscriptions us
         INNER JOIN packages p ON p.id = us."packageId"
         WHERE us.status = 'ACTIVE'
           AND p.type = 'PRO'
           AND (us."expiresAt" IS NULL OR us."expiresAt" > ${now})
      ) AS pro_subs,
      (SELECT COUNT(*)::int FROM ai_usage_logs WHERE "createdAt" >= ${dayStart}) AS ai_today,
      (SELECT COUNT(*)::int FROM ai_usage_logs
         WHERE "createdAt" >= ${dayStart} AND status <> 'SUCCESS') AS ai_errors_today,
      (SELECT COUNT(*)::int FROM ai_usage_logs WHERE "createdAt" >= ${monthStart}) AS ai_month,
      (SELECT COALESCE(SUM(amount), 0)::int FROM credit_transactions
         WHERE type = 'AI_USAGE' AND "createdAt" >= ${monthStart}) AS credits_used_month,
      (SELECT COALESCE(SUM(balance), 0)::int FROM credit_wallets) AS wallet_total,
      (SELECT COUNT(*)::int FROM payments WHERE status = 'PENDING') AS pending_payments
  `;

  const recentAudit = await prisma.adminAuditLog.findMany({
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
  });

  return {
    users: {
      total: n(stats?.total_users),
      active: n(stats?.active_users),
      pro: n(stats?.pro_subs),
      newThisWeek: n(stats?.new_users_week),
    },
    ai: {
      requestsToday: n(stats?.ai_today),
      errorsToday: n(stats?.ai_errors_today),
      requestsThisMonth: n(stats?.ai_month),
    },
    credits: {
      usedThisMonth: Math.abs(n(stats?.credits_used_month)),
      totalBalance: n(stats?.wallet_total),
    },
    payments: { pending: n(stats?.pending_payments) },
    recentAudit: recentAudit.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** Cached ~60s — dashboard is a summary, not live tick. */
export const getDashboardStats = unstable_cache(
  loadDashboardStats,
  ["admin-dashboard-stats"],
  { revalidate: 60 },
);
