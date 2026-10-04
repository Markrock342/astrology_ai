import { handle, ok } from "@/lib/http";
import { requireAdmin, requireSuperAdmin } from "@/server/auth/rbac";
import { getUserDetail } from "@/server/admin/user-admin-service";
import { deleteUserAccountAsAdmin } from "@/server/user/account-deletion-service";
import { clientIp } from "@/lib/rate-limit";

/** GET /api/admin/users/:id — full user detail (wallet, subscriptions, txns). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getUserDetail(id));
  });
}

/** DELETE /api/admin/users/:id — Super Admin deletes a user (audited, PDPA). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const { id } = await ctx.params;
    const ip = clientIp(req);
    await deleteUserAccountAsAdmin(id, { id: admin.id, ip });
    return ok({ deleted: true });
  });
}
