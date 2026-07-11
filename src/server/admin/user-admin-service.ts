import type { Prisma, Role, UserStatus, CreditTxnType } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addCredits, deductCredits } from "@/server/credit/credit-service";
import { writeAudit } from "@/server/audit/audit-service";

/**
 * Admin user-management service. Every mutation writes an audit log with the
 * acting admin + before/after snapshots (business rule 7). Credit changes go
 * through the credit-service ledger — never touch `balance` directly.
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
        creditWallet: { select: { balance: true } },
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
      birthProfile: true,
      creditWallet: { select: { balance: true, version: true } },
      subscriptions: {
        orderBy: { createdAt: "desc" },
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
  return user;
}

export async function setUserStatus(userId: string, status: UserStatus, actor: Actor) {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
  if (!before) throw new AppError("NOT_FOUND", "User not found");

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

export async function adjustUserCredits(
  userId: string,
  input: { amount: number; type: CreditTxnType; note?: string },
  actor: Actor,
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  return prisma.$transaction(async (tx) => {
    const ref = {
      type: input.type,
      note: input.note,
      createdByAdminId: actor.id,
      referenceType: "admin",
      referenceId: userId,
    };
    const result =
      input.type === "ADMIN_DEDUCT"
        ? await deductCredits(userId, input.amount, ref, tx)
        : await addCredits(userId, input.amount, ref, tx);

    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.credits.adjust",
        entityType: "credit_wallet",
        entityId: userId,
        after: { amount: input.amount, type: input.type, note: input.note, balance: result.balance },
        ipAddress: actor.ip,
      },
      tx,
    );
    return result;
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
