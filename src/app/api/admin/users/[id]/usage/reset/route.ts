import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { adminResetUsageQuota } from "@/server/admin/user-admin-service";
import { clientIp } from "@/lib/rate-limit";

/** Restore the included pool to 100%; preserve top-ups and all cost history. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = clientIp(req);
    return ok(
      await adminResetUsageQuota(id, { id: admin.id, role: admin.role, ip }),
    );
  });
}
