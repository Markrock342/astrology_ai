import { handle } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { assertAdmin2faVerified } from "@/server/auth/admin-2fa-service";
import { streamPaymentProof } from "@/server/payment/payment-proof";

/**
 * GET /api/payments/proof/[id] — stream slip image for owner or admin only.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { id: true, userId: true, proofUrl: true },
    });
    if (!payment?.proofUrl) {
      throw new AppError("NOT_FOUND", "ไม่พบสลิป");
    }

    const isOwner = payment.userId === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (!isOwner && !isAdmin) {
      throw new AppError("FORBIDDEN", "ไม่มีสิทธิ์ดูสลิปนี้");
    }
    // Someone else's slip is an admin read like any other: 2FA first.
    if (!isOwner) await assertAdmin2faVerified(user.id);

    return streamPaymentProof(payment.proofUrl);
  });
}
