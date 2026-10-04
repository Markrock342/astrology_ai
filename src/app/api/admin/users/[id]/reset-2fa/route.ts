import { handle, ok } from "@/lib/http";
import { requireSuperAdmin } from "@/server/auth/rbac";
import { resetAdminTotp } from "@/server/auth/admin-2fa-service";
import { clientIp } from "@/lib/rate-limit";

/** POST /api/admin/users/:id/reset-2fa — Super Admin clears target TOTP. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const { id } = await ctx.params;
    const ip = clientIp(req);
    await resetAdminTotp(id, { id: admin.id, ip });
    return ok({ reset: true });
  });
}
