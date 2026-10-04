import { writeAudit } from "@/server/audit/audit-service";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

export async function updateDisplayName(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new AppError("VALIDATION", "กรุณาระบุชื่อผู้ใช้");

  return prisma.user.update({
    where: { id: userId },
    data: { name: trimmed },
    select: { id: true, name: true, email: true },
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  if (!user.passwordHash) {
    throw new AppError(
      "VALIDATION",
      "บัญชีนี้เข้าสู่ระบบด้วย Google — ไม่สามารถเปลี่ยนรหัสผ่านได้",
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError("VALIDATION", "รหัสผ่านปัจจุบันไม่ถูกต้อง");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { ok: true };
}

/** Cancel active Pro subscription (Phase 1 manual billing — user reverts to Free). */
export async function cancelActiveSubscription(userId: string) {
  const sub = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      package: { type: "PRO" },
      // An expired row (e.g. the ended promotion) is not a plan to cancel.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!sub) {
    throw new AppError("VALIDATION", "ไม่มีแพ็กเกจ Pro ที่ใช้งานอยู่");
  }
  // A plan an admin gave is the admin's to take back. A user-side cancel used
  // to drop it silently, with no record — the owner saw an account set to
  // "Pro forever" turn Free "เฉยๆ".
  if (sub.activationSource === "ADMIN_MANUAL") {
    throw new AppError("VALIDATION", "แพ็กเกจนี้ได้รับจากแอดมิน — ติดต่อแอดมินหากต้องการยกเลิก");
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSubscription.update({
      where: { id: sub.id },
      data: { status: "CANCELLED" },
    });
    // Recorded with the user as the actor, so the plan history shows who did it.
    await writeAudit(
      {
        adminUserId: userId,
        action: "user.subscription.self_cancel",
        entityType: "user_subscription",
        entityId: userId,
        before: { id: sub.id, expiresAt: sub.expiresAt, activationSource: sub.activationSource },
      },
      tx,
    );
  });
  invalidateUserBootstrap(userId);

  return { cancelled: true };
}
