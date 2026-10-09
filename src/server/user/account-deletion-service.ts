import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { deletePaymentProofBlob, deleteUserSlipFolder } from "@/server/payment/payment-proof";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/server/auth/account-lookup";

const hashEmail = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 16);

type DeleteActor = { id: string; ip?: string };

async function paymentProofUrls(userId: string): Promise<Array<string | null>> {
  const payments = await prisma.payment.findMany({
    where: { userId },
    select: { proofUrl: true },
  });
  return payments.map((p) => p.proofUrl);
}

/**
 * Slips go only after the rows are gone: deleting them first meant a failed
 * deletion left the user's payments with no proof.
 */
async function deletePaymentProofs(userId: string, urls: Array<string | null>): Promise<void> {
  await Promise.all(urls.map((url) => deletePaymentProofBlob(url)));
  // Slips uploaded but never sent have no payment row; the folder has them
  // all. Anything this misses, the daily orphan sweep removes.
  await deleteUserSlipFolder(userId);
}

/**
 * Rows that point at the user without cascading. Any one of them made
 * `user.delete` fail with a foreign-key error: a user who had cancelled their
 * own Pro (their audit row) could never delete their account, nor could a
 * staff member who had ever done anything.
 *
 * Optional pointers are cleared. The user's own audit rows (self-cancel) go
 * with them. A staff member's audit trail and content revisions are kept and
 * handed to the admin deleting them — the deletion's own audit row records
 * whose they were.
 */
async function detachUserRefs(
  tx: Prisma.TransactionClient,
  userId: string,
  heirId: string | null,
): Promise<{ reassignedAudit: number; reassignedRevisions: number }> {
  await tx.creditTransaction.updateMany({ where: { createdByAdminId: userId }, data: { createdByAdminId: null } });
  await tx.usageTransaction.updateMany({ where: { createdByAdminId: userId }, data: { createdByAdminId: null } });
  await tx.payment.updateMany({ where: { reviewedByAdminId: userId }, data: { reviewedByAdminId: null } });
  await tx.promptTemplate.updateMany({ where: { draftUpdatedById: userId }, data: { draftUpdatedById: null } });
  await tx.knowledgeDoc.updateMany({ where: { draftUpdatedById: userId }, data: { draftUpdatedById: null } });
  await tx.appSetting.updateMany({ where: { draftUpdatedById: userId }, data: { draftUpdatedById: null } });
  await tx.faqItem.updateMany({ where: { draftUpdatedById: userId }, data: { draftUpdatedById: null } });
  await tx.adminAuditLog.deleteMany({
    where: { adminUserId: userId, action: "user.subscription.self_cancel" },
  });
  if (!heirId) return { reassignedAudit: 0, reassignedRevisions: 0 };
  const audit = await tx.adminAuditLog.updateMany({ where: { adminUserId: userId }, data: { adminUserId: heirId } });
  const revisions = await tx.contentRevision.updateMany({ where: { adminUserId: userId }, data: { adminUserId: heirId } });
  return { reassignedAudit: audit.count, reassignedRevisions: revisions.count };
}

/** Self-serve account deletion (PDPA). Regular users only. */
export async function deleteMyAccount(
  userId: string,
  proof: { password?: string; email?: string } = {},
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, passwordHash: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  if (user.role !== "USER") {
    throw new AppError("FORBIDDEN", "บัญชีผู้ดูแลระบบต้องให้ Super Admin ลบ");
  }
  // The owner confirms: the password, or (a Google account has none) the
  // email typed out. A session alone was enough to delete everything.
  await rateLimit(`delete-account:${userId}`, 5, 15 * 60_000);
  if (user.passwordHash) {
    if (!proof.password || !(await bcrypt.compare(proof.password, user.passwordHash))) {
      throw new AppError("VALIDATION", "รหัสผ่านไม่ถูกต้อง");
    }
  } else if (normalizeEmail(proof.email ?? "") !== normalizeEmail(user.email)) {
    throw new AppError("VALIDATION", "พิมพ์อีเมลให้ตรงกับบัญชีของคุณ");
  }

  const proofs = await paymentProofUrls(userId);
  await prisma.$transaction(async (tx) => {
    await detachUserRefs(tx, userId, null);
    await tx.user.delete({ where: { id: userId } });
  });
  await deletePaymentProofs(userId, proofs);
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

  const proofs = await paymentProofUrls(targetUserId);

  await prisma.$transaction(async (tx) => {
    const handedOver = await detachUserRefs(tx, targetUserId, actor.id);
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "user.delete",
        entityType: "user",
        entityId: targetUserId,
        // The account is gone (PDPA): keep who it was as a hash the team can
        // match against a known address, not the address itself.
        before: { emailHash: hashEmail(user.email), role: user.role },
        after: handedOver.reassignedAudit || handedOver.reassignedRevisions ? { handedOver } : null,
        ipAddress: actor.ip,
      },
      tx,
    );
    await tx.user.delete({ where: { id: targetUserId } });
  });
  await deletePaymentProofs(targetUserId, proofs);
}
