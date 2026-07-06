import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { discardSettingDraft } from "@/server/admin/settings-admin-service";

/** POST /api/admin/settings/:key/discard-draft */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { key } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await discardSettingDraft(key, { id: admin.id, ip }));
  });
}
