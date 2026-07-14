import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { adminResetUsageQuota } from "@/server/admin/user-admin-service";

/** POST /api/admin/users/:id/usage/reset — clear this period's AI usage quota. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await adminResetUsageQuota(id, { id: admin.id, role: admin.role, ip }),
    );
  });
}
