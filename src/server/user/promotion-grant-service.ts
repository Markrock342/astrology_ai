import { prisma } from "@/server/db";
import {
  getLaunchPromotionUsageReferenceId,
  isLaunchProPromotionActive,
  LAUNCH_PRO_PROMOTION,
} from "@/config/promotion";
import { grantIncludedUsage } from "@/server/usage/usage-budget-service";

/**
 * Give an existing account this promotion's AI budget, once.
 *
 * Sign-ups get it in provisioning, but a promotion opened after launch has to
 * reach accounts that already exist. A migration would only reach them if the
 * host ran migrations on deploy, and ours does not, so the grant is lazy: the
 * first time an account is read during the window it is topped up to the full
 * Pro budget — their usage bar reads 100% again.
 *
 * Idempotent through the usage ledger: the same reference id is written by
 * provisioning, so an account is never granted twice per campaign. A racing
 * double call is harmless because the grant SETS the balance rather than
 * adding to it.
 */
export async function ensurePromotionUsageGrant(
  userId: string,
  now = new Date(),
): Promise<void> {
  if (!isLaunchProPromotionActive(now)) return;

  const referenceId = getLaunchPromotionUsageReferenceId(userId);
  const already = await prisma.usageTransaction.findFirst({
    where: { userId, referenceType: "PROMOTION", referenceId },
    select: { id: true },
  });
  if (already) return;

  const proPkg = await prisma.package.findUnique({
    where: { code: "PRO" },
    select: { usageBudgetUnits: true },
  });
  const amountUnits = Math.round(
    ((proPkg?.usageBudgetUnits ?? 0) * LAUNCH_PRO_PROMOTION.usageGrantPercent) /
      100,
  );
  if (amountUnits <= 0) return;

  await grantIncludedUsage(
    userId,
    amountUnits,
    {
      type: "PROMOTION",
      referenceType: "PROMOTION",
      referenceId,
      note: "โปรโมชัน Pro 7 วัน — รีเซ็ตงบการใช้งาน AI เต็ม 100%",
    },
    {
      startsAt: LAUNCH_PRO_PROMOTION.startsAt,
      endsAt: LAUNCH_PRO_PROMOTION.endsAt,
    },
  );
}
