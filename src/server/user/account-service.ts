import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getBalance } from "@/server/credit/credit-service";
import { MAX_BIRTH_EDITS, isStaffRole } from "@/server/user/birth-profile-service";

/** Effective plan = an ACTIVE, non-expired Pro subscription, else FREE. */
export async function getEffectivePlan(userId: string): Promise<"FREE" | "PRO"> {
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
      subscriptions: {
        where: {
          status: "ACTIVE",
          package: { type: "PRO" },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        take: 1,
        select: { id: true, expiresAt: true },
      },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const plan: "FREE" | "PRO" = user.subscriptions.length > 0 ? "PRO" : "FREE";
  const balance = user.creditWallet?.balance ?? 0;
  const proExpiresAt = user.subscriptions[0]?.expiresAt?.toISOString() ?? null;

  const editsRemaining = isStaffRole(user.role)
    ? 999
    : user.birthProfile
      ? Math.max(0, MAX_BIRTH_EDITS - user.birthProfile.editCount)
      : MAX_BIRTH_EDITS;

  const { passwordHash, ...profile } = user;
  // Drop relation bags that are not part of the public profile payload.
  delete (profile as { creditWallet?: unknown }).creditWallet;
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
    creditBalance: balance,
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
          dailyLimit: true,
          monthlyLimit: true,
        },
      },
    },
  });

  const [plan, balance] = await Promise.all([
    getEffectivePlan(userId),
    getBalance(userId),
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
                dailyLimit: true,
                monthlyLimit: true,
              },
            },
          },
        })
      : null;

  return {
    plan,
    credits: balance,
    creditBalance: balance,
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
