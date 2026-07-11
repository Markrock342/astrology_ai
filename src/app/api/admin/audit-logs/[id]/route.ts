import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/rbac";
import { getAuditLogDetail } from "@/server/admin/log-admin-service";

/** GET /api/admin/audit-logs/:id — lazy-load before/after JSON. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const row = await getAuditLogDetail(id);
    if (!row) throw new AppError("NOT_FOUND", "ไม่พบบันทึก");
    return ok(row);
  });
}
