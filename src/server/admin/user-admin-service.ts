import type { Prisma, Role, UserStatus, CreditTxnType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addCredits } from "@/server/credit/credit-service";
import {
  addPurchasedUsage,
  availableUsagePercent,
  deductUsageCost,
  grantIncludedUsage,
} from "@/server/usage/usage-budget-service";
import { writeAudit } from "@/server/audit/audit-service";
import { getMyUsage } from "@/server/account/usage-service";
import { getUserCost } from "@/server/admin/cost-admin-service";
import { provisionUser } from "@/server/auth/provisioning";
import { normalizeEmail } from "@/server/auth/account-lookup";

/**
 * Admin user-management service. Every mutation writes an audit log with the
 * acting admin + before/after snapshots (business rule 7). Usage changes go
 * through the immutable usage ledger.
 */

type Actor = { id: string; role?: Role; ip?: string };

export type ListUsersArgs = {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  role?: "USER" | "ADMIN" | "SUPER_ADMIN";
};

export async function listUsers(args: ListUsersArgs) {
  const where: Prisma.UserWhereInput = {
    ...(args.status ? { status: args.status } : {}),
    ...(args.role ? { role: args.role } : {}),
    ...(args.search
      ? {
          OR: [
            { email: { contains: args.search, mode: "insensitive" } },
            { name: { contains: args.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        usageWallet: {
          select: {
            includedBalanceUnits: true,
            includedAllowanceUnits: true,
            purchasedBalanceUnits: true,
          },
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { package: { select: { code: true, type: true } }, expiresAt: true },
        },
      },
    }),
  ]);

  return { total, page: args.page, pageSize: args.pageSize, items };
}

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      birthProfile: {
        select: {
          id: true,
          nickname: true,
          birthProvince: true,
          editCount: true,
        },
      },
      creditWallet: { select: { balance: true, version: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          startsAt: true,
          expiresAt: true,
          activationSource: true,
          package: { select: { code: true, name: true, type: true } },
        },
      },
      creditTxns: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, amount: true, type: true, note: true, createdAt: true },
      },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  const [usage, cost] = await Promise.all([
    getMyUsage(userId),
    getUserCost(userId),
  ]);
  return {
    ...user,
    birthProfile: user.birthProfile
      ? {
          hasBirthProfile: true as const,
          nickname: user.birthProfile.nickname,
          birthProvince: user.birthProfile.birthProvince,
          editCount: user.birthProfile.editCount,
        }
      : null,
    usage,
    cost,
  };
}

/** Reveal full birth PII — audited. */
export async function revealUserBirthProfile(
  userId: string,
  actor: Actor,
) {
  const profile = await prisma.birthProfile.findUnique({
    where: { userId },
  });
  if (!profile) throw new AppError("NOT_FOUND", "ยังไม่มีข้อมูลวันเกิด");

  await writeAudit({
    adminUserId: actor.id,
    action: "user.birth_reveal",
    entityType: "user",
    entityId: userId,
    before: null,
    after: { revealed: true },
    ipAddress: actor.ip,
  });

  return {
    nickname: profile.nickname,
    birthDate: profile.birthDate.toISOString(),
    birthTime: profile.birthTime,
    birthTimeKnown: profile.birthTimeKnown,
    gender: profile.gender,
    birthCountry: profile.birthCountry,
    birthProvince: profile.birthProvince,
    birthDistrict: profile.birthDistrict,
    birthLocation: profile.birthLocation,
    additionalInfo: profile.additionalInfo,
    editCount: profile.editCount,
  };
}

export async function setUserStatus(userId: string, status: UserStatus, actor: Actor) {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });
  if (!before) throw new AppError("NOT_FOUND", "User not found");

  // Same tier rule as setUserRole: a plain ADMIN must not be able to lock out a
  // SUPER_ADMIN. Without this an ADMIN could disable every SUPER_ADMIN and seize
  // the top tier. Only a SUPER_ADMIN may act on a SUPER_ADMIN account.
  if (
    before.role === "SUPER_ADMIN" &&
    actor.role !== "SUPER_ADMIN" &&
    userId !== actor.id
  ) {
    throw new AppError("FORBIDDEN", "ADMIN ไม่สามารถแก้บัญชี SUPER_ADMIN ได้");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, status: true },
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.status.update",
        entityType: "user",
        entityId: userId,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

/**
 * Change a user's role.
 * - SUPER_ADMIN: may set USER / ADMIN / SUPER_ADMIN
 * - ADMIN: may set USER / ADMIN only (cannot touch SUPER_ADMIN accounts)
 * A staff user cannot demote themselves — prevents locking everyone out.
 */
export async function setUserRole(userId: string, role: Role, actor: Actor) {
  if (!actor.role) {
    throw new AppError("FORBIDDEN", "ไม่มีสิทธิ์เปลี่ยนบทบาท");
  }
  if (userId === actor.id && role !== actor.role) {
    throw new AppError("VALIDATION", "ไม่สามารถเปลี่ยนบทบาทของตัวเองได้");
  }

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!before) throw new AppError("NOT_FOUND", "User not found");

  if (actor.role === "ADMIN") {
    if (role === "SUPER_ADMIN") {
      throw new AppError("FORBIDDEN", "ADMIN ไม่สามารถมอบสิทธิ์ SUPER_ADMIN ได้");
    }
    if (before.role === "SUPER_ADMIN") {
      throw new AppError("FORBIDDEN", "ADMIN ไม่สามารถแก้บัญชี SUPER_ADMIN ได้");
    }
  } else if (actor.role !== "SUPER_ADMIN") {
    throw new AppError("FORBIDDEN", "ไม่มีสิทธิ์เปลี่ยนบทบาท");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.role.update",
        entityType: "user",
        entityId: userId,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

/** Restore the included pool to 100% without deleting cost history or top-ups. */
export async function adminResetUsageQuota(userId: string, actor: Actor) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  return prisma.$transaction(async (tx) => {
    const [wallet, activeSubscription] = await Promise.all([
      tx.usageWallet.findUnique({ where: { userId } }),
      tx.userSubscription.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          startsAt: true,
          expiresAt: true,
          package: { select: { usageBudgetUnits: true, code: true } },
        },
      }),
    ]);
    const allowanceUnits =
      wallet?.includedAllowanceUnits ||
      activeSubscription?.package.usageBudgetUnits ||
      0;
    if (allowanceUnits <= 0) {
      throw new AppError("VALIDATION", "แพ็กเกจนี้ไม่มีงบ usage ให้รีเซ็ต");
    }
    const before = wallet
      ? {
          includedBalanceUnits: wallet.includedBalanceUnits,
          purchasedBalanceUnits: wallet.purchasedBalanceUnits,
        }
      : null;
    const updated = await grantIncludedUsage(
      userId,
      allowanceUnits,
      {
        type: "ADMIN_ADD",
        referenceType: "admin_usage_reset",
        referenceId: `${actor.id}:${Date.now()}`,
        note: `คืน usage รอบแพ็กเกจเป็น 100% โดยแอดมิน${activeSubscription ? ` (${activeSubscription.package.code})` : ""}`,
        createdByAdminId: actor.id,
      },
      {
        startsAt: wallet?.periodStartedAt ?? activeSubscription?.startsAt ?? new Date(),
        endsAt: wallet?.periodEndsAt ?? activeSubscription?.expiresAt ?? null,
      },
      tx,
    );
    const after = {
      includedBalanceUnits: updated.includedBalanceUnits,
      purchasedBalanceUnits: updated.purchasedBalanceUnits,
      remainingPercent: availableUsagePercent(
        updated.includedBalanceUnits,
        updated.purchasedBalanceUnits,
        updated.includedAllowanceUnits,
      ),
    };
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.usage_budget.reset",
        entityType: "usage_wallet",
        entityId: userId,
        before,
        after,
        ipAddress: actor.ip,
      },
      tx,
    );
    return after;
  });
}

/** Adjust cost-weighted usage in percentage points; positive adjustments are top-up-like. */
export async function adjustUserCredits(
  userId: string,
  input: { amount: number; type: CreditTxnType; note?: string },
  actor: Actor,
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.usageWallet.findUnique({
      where: { userId },
    });
    if (!wallet || wallet.includedAllowanceUnits <= 0) {
      throw new AppError("VALIDATION", "ผู้ใช้นี้ยังไม่มีฐาน usage 100%");
    }
    const amountUnits = Math.max(
      1,
      Math.round((wallet.includedAllowanceUnits * input.amount) / 100),
    );
    const ref = {
      type: input.type,
      note: input.note,
      createdByAdminId: actor.id,
      referenceType: "admin",
      referenceId: `${actor.id}:${Date.now()}`,
    };
    if (input.type === "ADMIN_DEDUCT") {
      await deductUsageCost(userId, amountUnits, ref, tx);
    } else {
      await addPurchasedUsage(userId, amountUnits, ref, tx);
    }
    const updated = await tx.usageWallet.findUniqueOrThrow({ where: { userId } });
    const remainingPercent = availableUsagePercent(
      updated.includedBalanceUnits,
      updated.purchasedBalanceUnits,
      updated.includedAllowanceUnits,
    );
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.usage.adjust",
        entityType: "usage_wallet",
        entityId: userId,
        before: { remainingPercent: availableUsagePercent(
          wallet.includedBalanceUnits,
          wallet.purchasedBalanceUnits,
          wallet.includedAllowanceUnits,
        ) },
        after: { amountPercent: input.amount, type: input.type, note: input.note, remainingPercent },
        ipAddress: actor.ip,
      },
      tx,
    );
    return { remainingPercent };
  });
}

/** Reset birth edit quota so the user can change birth data again. */
export async function adminResetBirthEdits(userId: string, actor: Actor) {
  const before = await prisma.birthProfile.findUnique({
    where: { userId },
    select: { id: true, editCount: true },
  });
  if (!before) throw new AppError("NOT_FOUND", "ยังไม่มีข้อมูลวันเกิด");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.birthProfile.update({
      where: { userId },
      data: { editCount: 0 },
      select: { id: true, editCount: true },
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.birth_edits.reset",
        entityType: "birth_profile",
        entityId: before.id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function setUserSubscription(
  userId: string,
  input: { packageCode: string; expiresAt?: Date | null; grantCredits?: boolean },
  actor: Actor,
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const pkg = await prisma.package.findUnique({ where: { code: input.packageCode } });
  if (!pkg) throw new AppError("NOT_FOUND", "Package not found");

  return prisma.$transaction(async (tx) => {
    const before = await tx.userSubscription.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, packageId: true, status: true },
    });

    // Retire any currently-active subscriptions before granting the new one.
    await tx.userSubscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });

    const created = await tx.userSubscription.create({
      data: {
        userId,
        packageId: pkg.id,
        status: "ACTIVE",
        expiresAt: input.expiresAt ?? null,
        activationSource: "ADMIN_MANUAL",
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        package: { select: { code: true, type: true } },
      },
    });

    // Optionally grant the package's credit quota in the same transaction so
    // activating Pro immediately gives the user usable credits.
    let grantedCredits = 0;
    if (input.grantCredits && pkg.creditQuota > 0) {
      await addCredits(
        userId,
        pkg.creditQuota,
        {
          type: "PACKAGE_RENEWAL",
          referenceType: "user_subscription",
          referenceId: created.id,
          note: `เปิดแพ็กเกจ ${pkg.code} โดยแอดมิน`,
          createdByAdminId: actor.id,
        },
        tx,
      );
      grantedCredits = pkg.creditQuota;
    }
    if (input.grantCredits && pkg.usageBudgetUnits > 0) {
      await grantIncludedUsage(
        userId,
        pkg.usageBudgetUnits,
        {
          type: "PACKAGE_RENEWAL",
          referenceType: "user_subscription",
          referenceId: `usage:${created.id}`,
          note: `เปิดรอบ usage แพ็กเกจ ${pkg.code} โดยแอดมิน`,
          createdByAdminId: actor.id,
        },
        { startsAt: new Date(), endsAt: input.expiresAt ?? null },
        tx,
      );
    }

    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.subscription.set",
        entityType: "user_subscription",
        entityId: userId,
        before,
        after: { ...created, grantedCredits },
        ipAddress: actor.ip,
      },
      tx,
    );
    return { ...created, grantedCredits };
  });
}

/** Create a new staff login. SUPER_ADMIN only — never promote via this path. */
export async function createStaffUser(
  input: {
    email: string;
    name?: string;
    password: string;
    role: "ADMIN" | "SUPER_ADMIN";
  },
  actor: Actor,
) {
  if (actor.role !== "SUPER_ADMIN") {
    throw new AppError("FORBIDDEN", "เฉพาะ SUPER_ADMIN สร้างแอดมินได้");
  }

  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (existing) {
    throw new AppError(
      "VALIDATION",
      "อีเมลนี้มีในระบบแล้ว — เปิดหน้ารายละเอียดผู้ใช้แล้วกดมอบสิทธิ์แอดมิน",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const created = await provisionUser({
    email,
    name: input.name ?? null,
    passwordHash,
    role: input.role,
    emailVerified: true,
  });

  await writeAudit({
    adminUserId: actor.id,
    action: "user.staff.create",
    entityType: "user",
    entityId: created.id,
    after: { id: created.id, email: created.email, role: created.role },
    ipAddress: actor.ip,
  });

  return { id: created.id, email: created.email, name: created.name, role: created.role };
}
