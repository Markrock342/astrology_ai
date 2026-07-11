import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { contentDraftSchema } from "@/lib/admin-schemas";
import { SETTING_VALUE_SCHEMA_BY_KEY } from "@/lib/setting-schemas";
import { requireAdmin } from "@/server/auth/rbac";
import { publishSetting } from "@/server/admin/settings-admin-service";

/** POST /api/admin/settings/:key/publish */
export async function POST(req: Request, ctx: { params: Promise<{ key: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { key } = await ctx.params;
    const schema = SETTING_VALUE_SCHEMA_BY_KEY[key];
    if (!schema) throw new AppError("NOT_FOUND", "Unknown setting key");
    const { value } = contentDraftSchema.parse(await req.json());
    const parsed = schema.parse(value);
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await publishSetting(key, parsed, { id: admin.id, ip }));
  });
}
