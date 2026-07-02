import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

/**
 * Writes an admin_audit_log row for sensitive admin changes (business rule 7).
 * Call this from every admin mutation (status change, credit adjust,
 * subscription, config edits, payment review) with before/after snapshots.
 */
export type AuditInput = {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
};

export async function writeAudit(
  input: AuditInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: (input.before as object | undefined) ?? undefined,
      afterJson: (input.after as object | undefined) ?? undefined,
      ipAddress: input.ipAddress,
    },
  });
}
