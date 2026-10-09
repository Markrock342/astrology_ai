import { prisma } from "@/server/db";
import { SLIP_RETENTION_DAYS } from "@/config/constants";
import {
  deletePaymentProofBlob,
  deleteStoredSlips,
  listStoredSlips,
} from "@/server/payment/payment-proof";

/**
 * PDPA retention: after admin review, keep the money row but delete the slip
 * blob once SLIP_RETENTION_DAYS have passed. PENDING slips are never pruned.
 */
export async function runSlipRetentionSweep(now = new Date()): Promise<{
  scanned: number;
  deleted: number;
  orphans: { scanned: number; deleted: number } | null;
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
    // Forget the slip only once it is really gone: clearing the link after a
    // failed delete left the image in storage with nothing pointing at it,
    // so no later sweep could remove it (PDPA).
    if (!(await deletePaymentProofBlob(payment.proofUrl))) continue;
    await prisma.payment.update({
      where: { id: payment.id },
      data: { proofUrl: null },
    });
    deleted += 1;
  }

  const orphans = await sweepOrphanSlips(now).catch((err) => {
    console.error("[slip-retention] orphan sweep failed:", err instanceof Error ? err.message : err);
    return null;
  });
  return { scanned: due.length, deleted, orphans };
}

/** A slip uploaded and never sent gets this long before it counts as abandoned. */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Slips nothing points at: uploaded then never sent with a payment, or left
 * behind by a deleted account whose blob delete failed. Neither the review
 * sweep above nor account deletion could ever find them again (PDPA).
 */
export async function sweepOrphanSlips(now = new Date()): Promise<{ scanned: number; deleted: number } | null> {
  // Database slips: an account's go with it (cascade); one never sent with
  // a payment goes after a day.
  const cutoff = new Date(now.getTime() - ORPHAN_GRACE_MS);
  const dbDeleted = await prisma.$executeRaw`
    DELETE FROM payment_slips s
    WHERE s."createdAt" < ${cutoff}
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p."proofUrl" = s.pathname)`;
  const slips = await listStoredSlips("payment-slips/");
  if (!slips) return { scanned: dbDeleted, deleted: dbDeleted };
  const orphans = await findOrphanSlips(slips, now);
  const ok = await deleteStoredSlips(orphans.map((s) => s.url));
  return { scanned: slips.length + dbDeleted, deleted: (ok ? orphans.length : 0) + dbDeleted };
}

export async function findOrphanSlips(
  slips: Array<{ url: string; pathname: string; uploadedAt: Date }>,
  now: Date,
): Promise<Array<{ url: string; pathname: string }>> {
  if (slips.length === 0) return [];
  const userIds = [...new Set(slips.map((s) => s.pathname.split("/")[1]).filter(Boolean))];
  const [users, referenced] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } }),
    prisma.payment.findMany({
      where: { proofUrl: { in: slips.flatMap((s) => [s.pathname, s.url]) } },
      select: { proofUrl: true },
    }),
  ]);
  const live = new Set(users.map((u) => u.id));
  const pointed = new Set(referenced.map((r) => r.proofUrl));
  return slips.filter((s) => {
    if (pointed.has(s.pathname) || pointed.has(s.url)) return false;
    const owner = s.pathname.split("/")[1];
    if (!owner || !live.has(owner)) return true;
    return now.getTime() - s.uploadedAt.getTime() > ORPHAN_GRACE_MS;
  });
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
