import { prisma } from "@/server/db";
import { SLIP_RETENTION_DAYS } from "@/config/constants";
import { deletePaymentProofBlob } from "@/server/payment/payment-proof";

/**
 * PDPA retention: after admin review, keep the money row but delete the slip
 * blob once SLIP_RETENTION_DAYS have passed. PENDING slips are never pruned.
 */
export async function runSlipRetentionSweep(now = new Date()): Promise<{
  scanned: number;
  deleted: number;
}> {
  const cutoff = new Date(
    now.getTime() - SLIP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  const due = await prisma.payment.findMany({
    where: {
      status: { in: ["APPROVED", "REJECTED"] },
      proofUrl: { not: null },
      reviewedAt: { lt: cutoff },
    },
    select: { id: true, proofUrl: true },
    take: 200,
  });

  let deleted = 0;
  for (const payment of due) {
    await deletePaymentProofBlob(payment.proofUrl);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { proofUrl: null },
    });
    deleted += 1;
  }

  return { scanned: due.length, deleted };
}

/** Alert helpers for stale PENDING payments (does not change status). */
export async function countOverduePendingPayments(
  hours = 48,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return prisma.payment.count({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
  });
}
