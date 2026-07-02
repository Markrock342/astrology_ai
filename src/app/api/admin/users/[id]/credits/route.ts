import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { userCreditSchema } from "@/lib/admin-schemas";
import { adjustUserCredits } from "@/server/admin/user-admin-service";

/** POST /api/admin/users/:id/credits — adjust credits via the ledger (audited). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = userCreditSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await adjustUserCredits(id, data, { id: admin.id, ip }));
  });
}
