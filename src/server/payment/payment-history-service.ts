import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { paymentHistoryQuerySchema } from "@/lib/admin-schemas";
import { paymentReceiptSchema, type PaymentHistoryItem, type PaymentHistoryList } from "@/lib/payment-history";
import { prisma } from "@/server/db";

type HistoryQuery = z.infer<typeof paymentHistoryQuerySchema>;
const reviewedTime = Prisma.sql`COALESCE(p."reviewedAt", a."createdAt")`;
const base = Prisma.sql`FROM payments p JOIN users u ON u.id = p."userId"
  LEFT JOIN LATERAL (
    SELECT l."afterJson", l."adminUserId", l."createdAt" FROM admin_audit_logs l
    WHERE l."entityType" = 'payment' AND l."entityId" = p.id
      AND l.action IN ('payment.approve', 'payment.reject')
    ORDER BY l."createdAt" DESC, l.id DESC LIMIT 1
  ) a ON TRUE
  LEFT JOIN users r ON r.id = COALESCE(a."adminUserId", p."reviewedByAdminId")`;

type Row = {
  id: string; status: "APPROVED" | "REJECTED"; amount: number; packageCode: string | null; note: string | null;
  createdAt: Date; transferredAt: Date | null; reviewedAt: Date | null;
  userId: string; memberName: string | null; memberEmail: string;
  reviewerId: string | null; reviewerName: string | null; reviewerEmail: string | null;
  reviewData: Prisma.JsonValue | null;
};

/** Read-only history. Never consult mutable catalog rules or a current wallet. */
export async function listPaymentHistory(q: HistoryQuery): Promise<PaymentHistoryList> {
  const filters = [Prisma.sql`p.status IN ('APPROVED', 'REJECTED')`];
  if (q.status) filters.push(Prisma.sql`p.status = ${q.status}::"PaymentStatus"`);
  if (q.reviewerId) filters.push(Prisma.sql`r.id = ${q.reviewerId}`);
  // Prisma DateTime columns store UTC timestamps without a timezone. Explicitly
  // convert bound instants to UTC, independent of PostgreSQL's session timezone.
  if (q.from) filters.push(Prisma.sql`${reviewedTime} >= (${new Date(`${q.from}T00:00:00+07:00`)}::timestamptz AT TIME ZONE 'UTC')`);
  if (q.to) filters.push(Prisma.sql`${reviewedTime} < (${new Date(new Date(`${q.to}T00:00:00+07:00`).getTime() + 86400000)}::timestamptz AT TIME ZONE 'UTC')`);
  if (q.search) {
    const term = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(Prisma.sql`(u.name ILIKE ${term} OR u.email ILIKE ${term} OR p.id ILIKE ${term}
      OR a."afterJson" #>> '{receipt,member,name}' ILIKE ${term}
      OR a."afterJson" #>> '{receipt,member,email}' ILIKE ${term})`);
  }
  const where = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;
  // Keep total/page/items consistent even when another admin finishes a review.
  return prisma.$transaction(async tx => {
    const counts = await tx.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total ${base} ${where}`;
    const total = Number(counts[0]?.total ?? 0);
    const page = Math.min(q.page, Math.max(1, Math.ceil(total / q.pageSize)));
    const rows = await tx.$queryRaw<Row[]>`SELECT p.id, p.status, p.amount, p."packageCode", p.note, p."createdAt", p."transferredAt",
      ${reviewedTime} AS "reviewedAt", p."userId", u.name AS "memberName", u.email AS "memberEmail",
      r.id AS "reviewerId", r.name AS "reviewerName", r.email AS "reviewerEmail", a."afterJson" AS "reviewData"
      ${base} ${where} ORDER BY ${reviewedTime} DESC NULLS LAST, p."createdAt" DESC, p.id DESC LIMIT ${q.pageSize} OFFSET ${(page - 1) * q.pageSize}`;
    const reviewers = await tx.$queryRaw<PaymentHistoryList["reviewers"]>`SELECT DISTINCT r.id, r.name, r.email ${base}
      WHERE p.status IN ('APPROVED', 'REJECTED') AND r.id IS NOT NULL ORDER BY r.name NULLS LAST, r.email`;
    const items: PaymentHistoryItem[] = rows.map(row => {
      const data = row.reviewData && typeof row.reviewData === "object" && !Array.isArray(row.reviewData) ? row.reviewData : {};
      const parsed = paymentReceiptSchema.safeParse(data.receipt);
      const receipt = parsed.success && parsed.data.decision === row.status && parsed.data.member.id === row.userId
        && parsed.data.reviewer.id === row.reviewerId ? parsed.data : null;
      return {
        id: row.id, status: row.status, reviewedAt: row.reviewedAt?.toISOString() ?? null, submittedAt: row.createdAt.toISOString(), transferredAt: row.transferredAt?.toISOString() ?? null,
        member: receipt?.member ?? { id: row.userId, name: row.memberName, email: row.memberEmail },
        reviewer: receipt?.reviewer ?? (row.reviewerId ? { id: row.reviewerId, name: row.reviewerName, email: row.reviewerEmail ?? "" } : null),
        amount: receipt?.amount ?? row.amount, packageCode: receipt?.packageCode ?? row.packageCode, note: receipt?.note ?? row.note,
        selfReview: row.userId === row.reviewerId, receipt,
      };
    });
    return { total, page, pageSize: q.pageSize, items, reviewers };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
