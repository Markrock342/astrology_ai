import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { userStatusSchema } from "@/lib/admin-schemas";
import { setUserStatus } from "@/server/admin/user-admin-service";

/** PATCH /api/admin/users/:id/status — enable/disable an account (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { status } = userStatusSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    // role is load-bearing: setUserStatus refuses to let a plain ADMIN disable a
    // SUPER_ADMIN, and it can only enforce that if it knows the actor's tier.
    return ok(
      await setUserStatus(id, status, { id: admin.id, role: admin.role, ip }),
    );
  });
}
