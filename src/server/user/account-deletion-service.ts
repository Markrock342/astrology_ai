import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { deletePaymentProofBlob } from "@/server/payment/payment-proof";

type DeleteActor = { id: string; ip?: string };

async function deleteUserPaymentProofs(userId: string): Promise<void> {
  const payments = await prisma.payment.findMany({
    where: { userId },
    select: { proofUrl: true },
  });
  await Promise.all(payments.map((p) => deletePaymentProofBlob(p.proofUrl)));
}

/** Self-serve account deletion (PDPA). Regular users only. */
export async function deleteMyAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  if (user.role !== "USER") {
    throw new AppError("FORBIDDEN", "บัญชีผู้ดูแลระบบต้องให้ Super Admin ลบ");
  }

  await deleteUserPaymentProofs(userId);
  await prisma.user.delete({ where: { id: userId } });
}

/** Admin deletion — Super Admin only, audited. */
export async function deleteUserAccountAsAdmin(
  targetUserId: string,
  actor: DeleteActor,
): Promise<void> {
  if (targetUserId === actor.id) {
    throw new AppError("VALIDATION", "ไม่สามารถลบบัญชีของตัวเองผ่าน admin API");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true, name: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  if (user.role === "SUPER_ADMIN") {
    const superCount = await prisma.user.count({
      where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    if (superCount <= 1) {
      throw new AppError("VALIDATION", "ไม่สามารถลบ Super Admin คนสุดท้ายได้");
    }
  }

  await deleteUserPaymentProofs(targetUserId);

  await prisma.$transaction(async (tx) => {
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.delete",
        entityType: "user",
        entityId: targetUserId,
        before: { email: user.email, role: user.role, name: user.name },
        after: null,
        ipAddress: actor.ip,
      },
      tx,
    );
    await tx.user.delete({ where: { id: targetUserId } });
  });
}
