import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getBalance } from "@/server/credit/credit-service";
import { MAX_BIRTH_EDITS } from "@/server/user/birth-profile-service";

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      birthProfile: { select: { id: true, nickname: true, editCount: true } },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const [plan, balance] = await Promise.all([
    getEffectivePlan(userId),
    getBalance(userId),
  ]);

  const editsRemaining = user.birthProfile
    ? Math.max(0, MAX_BIRTH_EDITS - user.birthProfile.editCount)
    : MAX_BIRTH_EDITS;

  return {
    ...user,
    hasBirthProfile: Boolean(user.birthProfile),
    birthEditsRemaining: editsRemaining,
    plan,
    creditBalance: balance,
    /** Flowchart: only Pro may use AI chat. */
    canChat: plan === "PRO",
  };
}

/** Current effective package/subscription details for GET /api/me/package. */
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

  return {
    plan,
    credits: balance,
    creditBalance: balance,
    canChat: plan === "PRO",
    subscription,
  };
}
