import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { adminResetBirthEdits } from "@/server/admin/user-admin-service";
import { clientIp } from "@/lib/rate-limit";

/** POST /api/admin/users/:id/birth-edits/reset — allow user to edit birth again. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = clientIp(_req);
    return ok(
      await adminResetBirthEdits(id, { id: admin.id, role: admin.role, ip }),
    );
  });
}
