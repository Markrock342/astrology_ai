import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { addCredits } from "@/server/credit/credit-service";
import { grantIncludedUsage } from "@/server/usage/usage-budget-service";
import { DEFAULTS } from "@/config/constants";
import {
  getLaunchPromotionCreditReferenceId,
  isLaunchProPromotionActive,
  LAUNCH_PRO_PROMOTION,
} from "@/config/promotion";

/**
 * Shared new-user provisioning. Creates the user, an (empty) credit wallet, and
 * a default Free subscription in one transaction, then grants the initial Free
 * credit via the immutable ledger. Used by both local registration and the
 * first-time OAuth (Google) sign-in so the setup stays identical.
 */
export async function provisionUser(input: {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  role?: Role;
  /** OAuth accounts are treated as email-verified immediately. */
  emailVerified?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash: input.passwordHash ?? null,
        role: input.role ?? "USER",
        emailVerifiedAt:
          input.emailVerified || !input.passwordHash ? new Date() : null,
      },
    });
    await tx.creditWallet.create({ data: { userId: created.id, balance: 0 } });
    await tx.usageWallet.create({ data: { userId: created.id } });

    const freePkg = await tx.package.findUnique({ where: { code: "FREE" } });
    if (freePkg) {
      await tx.userSubscription.create({
        data: {
          userId: created.id,
          packageId: freePkg.id,
          status: "ACTIVE",
          activationSource: "SYSTEM_DEFAULT",
        },
      });
      if (freePkg.usageBudgetUnits > 0) {
        await grantIncludedUsage(
          created.id,
          freePkg.usageBudgetUnits,
          {
            type: "INITIAL_GRANT",
            referenceType: "user",
            referenceId: `free-signup:${created.id}`,
            note: "สิทธิ์ทดลองใช้งาน AI",
          },
          { startsAt: new Date(), endsAt: null },
          tx,
        );
      }
    }

    const promotionActive = isLaunchProPromotionActive();
    if (promotionActive) {
      const proPkg = await tx.package.findUnique({ where: { code: "PRO" } });
      if (proPkg) {
        await tx.userSubscription.create({
          data: {
            userId: created.id,
            packageId: proPkg.id,
            status: "ACTIVE",
            startsAt: LAUNCH_PRO_PROMOTION.startsAt,
            expiresAt: LAUNCH_PRO_PROMOTION.endsAt,
            activationSource: "SYSTEM_DEFAULT",
          },
        });
        const promotionUsage = Math.round(
          (proPkg.usageBudgetUnits * LAUNCH_PRO_PROMOTION.creditGrant) /
            Math.max(proPkg.creditQuota, 1),
        );
        if (promotionUsage > 0) {
          await grantIncludedUsage(
            created.id,
            promotionUsage,
            {
              type: "PROMOTION",
              referenceType: "PROMOTION",
              referenceId: `usage:${getLaunchPromotionCreditReferenceId(created.id)}`,
              note: "Pro ทดลอง — งบการใช้งาน AI",
            },
            {
              startsAt: LAUNCH_PRO_PROMOTION.startsAt,
              endsAt: LAUNCH_PRO_PROMOTION.endsAt,
            },
            tx,
          );
        }
      }
    }

    // The grant is the Free package's own quota, so raising it in the CMS takes
    // effect for the next sign-up. It used to come from a hardcoded constant,
    // which meant the admin's number was decorative.
    const grant = freePkg?.creditQuota ?? DEFAULTS.freeCreditQuota;
    if (grant > 0) {
      await addCredits(
        created.id,
        grant,
        { type: "INITIAL_GRANT", note: `Free sign-up grant (${freePkg?.code ?? "default"})` },
        tx,
      );
    }


    if (promotionActive) {
      await addCredits(
        created.id,
        LAUNCH_PRO_PROMOTION.creditGrant,
        {
          type: "PROMOTION",
          referenceType: "PROMOTION",
          // Ledger idempotency is global, so namespace the campaign per user.
          referenceId: getLaunchPromotionCreditReferenceId(created.id),
          note: `สำรองเครดิตเดิมสำหรับ Pro ทดลอง 1 เดือน`,
        },
        tx,
      );
    }

    return created;
  });
}

export type EnsureOAuthResult = "ok" | "disabled";

/**
 * Ensure a user exists for an OAuth sign-in. Auto-creates on the first sign-in;
 * returns "disabled" so the caller can block a disabled account.
 */
export async function ensureOAuthUser(input: {
  email: string;
  name?: string | null;
}): Promise<EnsureOAuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return existing.status === "DISABLED" ? "disabled" : "ok";
  }
  await provisionUser({ email: input.email, name: input.name, emailVerified: true });
  return "ok";
}
