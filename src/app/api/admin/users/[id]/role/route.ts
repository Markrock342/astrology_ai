import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { userRoleSchema } from "@/lib/admin-schemas";
import { setUserRole } from "@/server/admin/user-admin-service";

/**
 * PATCH /api/admin/users/:id/role — grant / revoke admin roles (audited).
 * ADMIN may set USER↔ADMIN; SUPER_ADMIN may also set SUPER_ADMIN.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { role } = userRoleSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await setUserRole(id, role, { id: admin.id, role: admin.role, ip }),
    );
  });
}
