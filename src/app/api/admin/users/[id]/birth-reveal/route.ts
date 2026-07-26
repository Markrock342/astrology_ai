import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { revealUserBirthProfile } from "@/server/admin/user-admin-service";

/** POST /api/admin/users/:id/birth-reveal — audited full birth PII. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await revealUserBirthProfile(id, {
        id: admin.id,
        role: admin.role,
        ip,
      }),
    );
  });
}
