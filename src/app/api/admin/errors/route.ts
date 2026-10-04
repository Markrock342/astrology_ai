import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { prisma } from "@/server/db";
import { requireAdmin, requireSuperAdmin } from "@/server/auth/rbac";
import { writeAudit } from "@/server/audit/audit-service";
import { clientIp } from "@/lib/rate-limit";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
});

const PAGE_SIZE = 25;

/** GET /api/admin/errors — unhandled production errors, newest first. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { page } = querySchema.parse(Object.fromEntries(searchParams));

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, last24h, items] = await Promise.all([
      prisma.appErrorLog.count(),
      prisma.appErrorLog.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.appErrorLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return ok({ total, last24h, page, pageSize: PAGE_SIZE, items });
  });
}

/**
 * DELETE /api/admin/errors — clear the log after triage. Super admins only,
 * and audited: any admin could wipe it without a trace.
 */
export async function DELETE(req: Request) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const { count } = await prisma.appErrorLog.deleteMany({});
    await writeAudit({
      adminUserId: admin.id,
      action: "errors.clear",
      entityType: "app_error_log",
      entityId: "all",
      after: { deleted: count },
      ipAddress: clientIp(req),
    });
    return ok({ deleted: count });
  });
}
