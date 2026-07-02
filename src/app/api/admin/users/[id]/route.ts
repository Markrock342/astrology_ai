import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getUserDetail } from "@/server/admin/user-admin-service";

/** GET /api/admin/users/:id — full user detail (wallet, subscriptions, txns). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getUserDetail(id));
  });
}
