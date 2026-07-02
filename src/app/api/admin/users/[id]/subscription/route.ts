import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { userSubscriptionSchema } from "@/lib/admin-schemas";
import { setUserSubscription } from "@/server/admin/user-admin-service";

/** PATCH /api/admin/users/:id/subscription — set the active package (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = userSubscriptionSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await setUserSubscription(
        id,
        { packageCode: data.packageCode, expiresAt: data.expiresAt ?? null },
        { id: admin.id, ip },
      ),
    );
  });
}
