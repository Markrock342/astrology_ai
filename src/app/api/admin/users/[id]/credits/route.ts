import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { userCreditSchema } from "@/lib/admin-schemas";
import { adjustUserCredits } from "@/server/admin/user-admin-service";
import { clientIp } from "@/lib/rate-limit";

/** Compatibility endpoint: adjust cost-weighted usage percentage (audited). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = userCreditSchema.parse(await req.json());
    const ip = clientIp(req);
    return ok(await adjustUserCredits(id, data, { id: admin.id, ip }));
  });
}
