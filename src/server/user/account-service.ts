import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getBalance } from "@/server/credit/credit-service";
import { availableUsagePercent } from "@/server/usage/usage-budget-service";
import { getUsageBudgetSnapshot } from "@/server/usage/usage-budget-service";
import { MAX_BIRTH_EDITS, isStaffRole } from "@/server/user/birth-profile-service";
import {
  isLaunchProPromotionActive,
  LAUNCH_PRO_PROMOTION,
} from "@/config/promotion";
import { resolveProExpiry } from "@/lib/pro-expiry";
import { ensurePromotionUsageGrant } from "@/server/user/promotion-grant-service";

/** Effective plan = an ACTIVE, non-expired Pro subscription, else FREE. */
export async function getEffectivePlan(userId: string): Promise<"FREE" | "PRO"> {
  // The database migration/provisioner also creates a timed Pro subscription.
  // This override keeps access correct during a rolling deploy before every
  // app instance has observed the migrated row.
  if (isLaunchProPromotionActive()) return "PRO";
  const sub = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      package: { type: "PRO" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return sub ? "PRO" : "FREE";
}

/** Current user profile + plan + wallet snapshot for GET /api/me. */
export async function getMe(userId: string) {
  const now = new Date();
  // A promotion opened after launch has to reach accounts that already exist,
  // and this is the call every session makes first. No-op outside the window
  // and after the account has been granted once.
  await ensurePromotionUsageGrant(userId, now);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      passwordHash: true,
      createdAt: true,
      birthProfile: { select: { id: true, nickname: true, editCount: true } },
      intake: { select: { id: true } },
      creditWallet: { select: { balance: true } },
      usageWallet: {
        select: {
          includedBalanceUnits: true,
          includedAllowanceUnits: true,
          purchasedBalanceUnits: true,
          purchasedAllowanceUnits: true,
        },
      },
      subscriptions: {
        where: {
          status: "ACTIVE",
          package: { type: "PRO" },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: { id: true, expiresAt: true },
      },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const promotionActive = isLaunchProPromotionActive(now);
  const plan: "FREE" | "PRO" =
    user.subscriptions.length > 0 || promotionActive ? "PRO" : "FREE";
  const balance = user.creditWallet?.balance ?? 0;
  const includedUsageBalance = user.usageWallet?.includedBalanceUnits ?? 0;
  const purchasedUsageBalance = user.usageWallet?.purchasedBalanceUnits ?? 0;
  const usageAllowance = user.usageWallet?.includedAllowanceUnits ?? 0;
  const proExpiry = resolveProExpiry({
    subscription: user.subscriptions[0] ?? null,
    promotionActive,
    promotionEndsAt: LAUNCH_PRO_PROMOTION.endsAt,
  });
  const proExpiresAt = proExpiry.endsAt?.toISOString() ?? null;

  const editsRemaining = isStaffRole(user.role)
    ? 999
    : user.birthProfile
      ? Math.max(0, MAX_BIRTH_EDITS - user.birthProfile.editCount)
      : MAX_BIRTH_EDITS;

  const { passwordHash, ...profile } = user;
  // Drop relation bags that are not part of the public profile payload.
  delete (profile as { creditWallet?: unknown }).creditWallet;
  delete (profile as { usageWallet?: unknown }).usageWallet;
  delete (profile as { subscriptions?: unknown }).subscriptions;
  delete (profile as { intake?: unknown }).intake;

  return {
    ...profile,
    hasPassword: Boolean(passwordHash),
    hasBirthProfile: Boolean(user.birthProfile),
    hasIntake: Boolean(user.intake),
    birthEditsRemaining: editsRemaining,
    birthEditsUnlimited: isStaffRole(user.role),
    plan,
    proExpiresAt,
    proNeverExpires: proExpiry.neverExpires,
    // Hidden for an account whose own Pro already outlasts the promotion —
    // "Pro ถึง 23 ก.ย." would read as if their plan ended that day.
    promotionEndsAt: proExpiry.showPromotion
      ? LAUNCH_PRO_PROMOTION.endsAt.toISOString()
      : null,
    promotionUsagePercent: proExpiry.showPromotion
      ? LAUNCH_PRO_PROMOTION.usageGrantPercent
      : null,
    creditBalance: balance,
    usageRemainingPercent: availableUsagePercent(
      includedUsageBalance,
      purchasedUsageBalance,
      usageAllowance,
    ),
    /** Free cannot chat AI — must upgrade to Pro (`CHAT_REQUIRES_PRO`). */
    canChat: plan === "PRO",
    emailVerified: Boolean(user.emailVerifiedAt),
    needsEmailVerification: Boolean(passwordHash && !user.emailVerifiedAt),
  };
}

export async function getMyPackage(userId: string) {
  const subscription = await prisma.userSubscription.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      startsAt: true,
      expiresAt: true,
      activationSource: true,
      package: {
        select: {
          code: true,
          name: true,
          type: true,
          price: true,
          billingLabel: true,
          creditQuota: true,
          usageBudgetUnits: true,
          dailyLimit: true,
          monthlyLimit: true,
        },
      },
    },
  });

  const [plan, balance, usageBudget] = await Promise.all([
    getEffectivePlan(userId),
    getBalance(userId),
    getUsageBudgetSnapshot(userId),
  ]);

  // Prefer the effective Pro subscription for expiry display (skip expired rows).
  const effectiveSub =
    plan === "PRO"
      ? await prisma.userSubscription.findFirst({
          where: {
            userId,
            status: "ACTIVE",
            package: { type: "PRO" },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            startsAt: true,
            expiresAt: true,
            activationSource: true,
            package: {
              select: {
                code: true,
                name: true,
                type: true,
                price: true,
                billingLabel: true,
                creditQuota: true,
                usageBudgetUnits: true,
                dailyLimit: true,
                monthlyLimit: true,
              },
            },
          },
        })
      : null;

  const proExpiry = resolveProExpiry({
    subscription: effectiveSub,
    promotionActive: isLaunchProPromotionActive(),
    promotionEndsAt: LAUNCH_PRO_PROMOTION.endsAt,
  });

  return {
    plan,
    credits: balance,
    creditBalance: balance,
    usageRemainingPercent: usageBudget.remainingPercent,
    usageUsedPercent: usageBudget.usedPercent,
    usagePeriodEndsAt: usageBudget.periodEndsAt?.toISOString() ?? null,
    /** When Pro ends — null when it never does (see resolveProExpiry). */
    proEndsAt: proExpiry.endsAt?.toISOString() ?? null,
    proNeverExpires: proExpiry.neverExpires,
    canChat: plan === "PRO",
    subscription: effectiveSub
      ? {
          ...effectiveSub,
          startsAt: effectiveSub.startsAt.toISOString(),
          expiresAt: effectiveSub.expiresAt?.toISOString() ?? null,
        }
      : subscription
        ? {
            ...subscription,
            startsAt: subscription.startsAt.toISOString(),
            expiresAt: subscription.expiresAt?.toISOString() ?? null,
          }
        : null,
  };
}
