import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit/audit-service";

/**
 * Give back the usage that paying Pro users lost on 1–2 Oct 2026.
 *
 * The September promotion set every wallet's period to end on 1 Oct, and the
 * period-end lapse then cut each wallet to the Free budget — including users
 * whose paid or admin-given Pro ran on past that date. The lapse is fixed
 * (lapseExpiredIncludedUsage follows a running Pro); this restores wallets it
 * already cut. It runs inside the app (admin page or scripts/repair-pro-lapse.ts)
 * because the production database is not reachable from outside the server.
 *
 * A wallet is repaired when its lapse ("period_end" ledger row, negative)
 * happened while the user had an ACTIVE Pro subscription that is still
 * running, and nothing has re-granted the included pool since. The units
 * taken are added back, capped at the Pro budget; the period follows the Pro.
 * Idempotent: each repair writes ADMIN_ADD "lapse-repair:<lapse row id>".
 */
export type ProLapseRepairRow = {
  userId: string;
  email: string | null;
  lapsedAt: string;
  proUntil: string | null;
  before: number;
  after: number;
};

export async function repairProLapse(opts: { apply: boolean; actorId?: string; ip?: string }) {
  const pro = await prisma.package.findUniqueOrThrow({ where: { code: "PRO" }, select: { usageBudgetUnits: true } });
  const lapses = await prisma.usageTransaction.findMany({
    where: { referenceType: "period_end", bucket: "INCLUDED", amountUnits: { lt: 0 } },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, amountUnits: true, createdAt: true },
  });
  const now = new Date();
  const rows: ProLapseRepairRow[] = [];
  let skipped = 0;

  for (const lapse of lapses) {
    const done = await prisma.usageTransaction.findFirst({
      where: { userId: lapse.userId, referenceId: `lapse-repair:${lapse.id}` },
      select: { id: true },
    });
    if (done) {
      skipped++;
      continue;
    }
    const sub = await prisma.userSubscription.findFirst({
      where: {
        userId: lapse.userId,
        status: "ACTIVE",
        package: { type: "PRO" },
        createdAt: { lte: lapse.createdAt },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { expiresAt: { sort: "desc", nulls: "first" } },
      select: { expiresAt: true },
    });
    if (!sub) continue; // not a running Pro: that lapse was right
    const regrant = await prisma.usageTransaction.findFirst({
      where: {
        userId: lapse.userId,
        bucket: "INCLUDED",
        createdAt: { gt: lapse.createdAt },
        type: { in: ["PACKAGE_RENEWAL", "PROMOTION", "INITIAL_GRANT"] },
      },
      select: { id: true },
    });
    if (regrant) {
      skipped++;
      continue;
    }
    const wallet = await prisma.usageWallet.findUnique({
      where: { userId: lapse.userId },
      select: { includedBalanceUnits: true, includedAllowanceUnits: true, user: { select: { email: true } } },
    });
    if (!wallet) continue;
    const next = Math.min(wallet.includedBalanceUnits - lapse.amountUnits, pro.usageBudgetUnits);
    rows.push({
      userId: lapse.userId,
      email: wallet.user?.email ?? null,
      lapsedAt: lapse.createdAt.toISOString(),
      proUntil: sub.expiresAt?.toISOString() ?? null,
      before: wallet.includedBalanceUnits,
      after: next,
    });
    if (!opts.apply) continue;
    await prisma.$transaction(async (tx) => {
      await tx.usageWallet.update({
        where: { userId: lapse.userId },
        data: {
          includedBalanceUnits: next,
          includedAllowanceUnits: Math.max(wallet.includedAllowanceUnits, pro.usageBudgetUnits),
          periodEndsAt: sub.expiresAt,
          version: { increment: 1 },
        },
      });
      await tx.usageTransaction.create({
        data: {
          userId: lapse.userId,
          amountUnits: next - wallet.includedBalanceUnits,
          type: "ADMIN_ADD",
          bucket: "INCLUDED",
          referenceType: "repair",
          referenceId: `lapse-repair:${lapse.id}`,
          note: "คืน usage ที่ถูกตัดเมื่อรอบโปรโมชันหมด ทั้งที่ยังเป็น Pro อยู่",
          createdByAdminId: opts.actorId,
        },
      });
      if (opts.actorId) {
        await writeAudit(
          {
            adminUserId: opts.actorId,
            action: "usage.repair_pro_lapse",
            entityType: "usage_wallet",
            entityId: lapse.userId,
            before: { includedBalanceUnits: wallet.includedBalanceUnits },
            after: { includedBalanceUnits: next, lapseId: lapse.id },
            ipAddress: opts.ip,
          },
          tx,
        );
      }
    });
  }

  return { applied: opts.apply, rows, skipped, lapsesSeen: lapses.length };
}
