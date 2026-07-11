import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { auditLogQuerySchema } from "@/lib/admin-schemas";
import { listAuditLogs } from "@/server/admin/log-admin-service";

/** GET /api/admin/audit-logs — paginated audit trail (who did what, when). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = auditLogQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await listAuditLogs(q));
  });
}
