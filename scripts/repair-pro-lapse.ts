/**
 * Give back the usage that paying Pro users lost on 1–2 Oct 2026.
 *
 * The September promotion set every wallet's period to end on 1 Oct, and the
 * period-end lapse then cut each wallet to the Free budget — including users
 * whose paid or admin-given Pro ran on past that date. The lapse is fixed in
 * code (lapseExpiredIncludedUsage now follows a running Pro); this restores
 * the wallets it already cut.
 *
 * A wallet is repaired when its lapse ("period_end" ledger row, negative)
 * happened while the user had an ACTIVE Pro subscription that is still
 * running, and nothing has re-granted the included pool since (a renewal or
 * an admin reset already made it whole). The units taken are added back,
 * capped at the Pro budget, and the period follows the Pro subscription.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/repair-pro-lapse.ts          # list only
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/repair-pro-lapse.ts --apply  # write
 *
 * Idempotent: each repair writes an ADMIN_ADD ledger row with referenceId
 * "lapse-repair:<lapse row id>", and a lapse already repaired is skipped.
 */
import { prisma } from "@/server/db";

const APPLY = process.argv.includes("--apply");

async function main() {
  const pro = await prisma.package.findUniqueOrThrow({ where: { code: "PRO" }, select: { usageBudgetUnits: true } });
  const lapses = await prisma.usageTransaction.findMany({
    where: { referenceType: "period_end", bucket: "INCLUDED", amountUnits: { lt: 0 } },
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, amountUnits: true, createdAt: true },
  });
  const now = new Date();
  let repaired = 0;
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
    if (!sub) continue; // was not a running Pro: the lapse was right
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
    const wallet = await prisma.usageWallet.findUnique({ where: { userId: lapse.userId } });
    if (!wallet) continue;
    const giveBack = -lapse.amountUnits;
    const next = Math.min(wallet.includedBalanceUnits + giveBack, pro.usageBudgetUnits);
    const added = next - wallet.includedBalanceUnits;
    console.log(
      `${APPLY ? "repair" : "would repair"} user …${lapse.userId.slice(-6)}: ${wallet.includedBalanceUnits} → ${next} ` +
        `(lapse ${lapse.createdAt.toISOString().slice(0, 10)}, Pro until ${sub.expiresAt?.toISOString().slice(0, 10) ?? "no end"})`,
    );
    repaired++;
    if (!APPLY) continue;
    await prisma.$transaction([
      prisma.usageWallet.update({
        where: { userId: lapse.userId },
        data: {
          includedBalanceUnits: next,
          includedAllowanceUnits: Math.max(wallet.includedAllowanceUnits, pro.usageBudgetUnits),
          periodEndsAt: sub.expiresAt,
          version: { increment: 1 },
        },
      }),
      prisma.usageTransaction.create({
        data: {
          userId: lapse.userId,
          amountUnits: added,
          type: "ADMIN_ADD",
          bucket: "INCLUDED",
          referenceType: "repair",
          referenceId: `lapse-repair:${lapse.id}`,
          note: "คืน usage ที่ถูกตัดเมื่อรอบโปรโมชันหมด ทั้งที่ยังเป็น Pro อยู่",
        },
      }),
    ]);
  }
  console.log(`\n${APPLY ? "repaired" : "to repair"}: ${repaired} · skipped (already whole or repaired): ${skipped} · lapses seen: ${lapses.length}`);
  if (!APPLY && repaired) console.log("Run again with --apply to write.");
}

main().finally(() => prisma.$disconnect());
