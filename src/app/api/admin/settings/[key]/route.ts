import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { settingUpdateSchema } from "@/lib/admin-schemas";
import { SETTING_VALUE_SCHEMA_BY_KEY } from "@/lib/setting-schemas";
import { requireAdmin } from "@/server/auth/rbac";
import { publishSetting } from "@/server/admin/settings-admin-service";

/** PUT /api/admin/settings/:key — publish CMS content (audited). */
export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { key } = await ctx.params;
    const schema = SETTING_VALUE_SCHEMA_BY_KEY[key];
    if (!schema) throw new AppError("NOT_FOUND", "Unknown setting key");
    const { value } = settingUpdateSchema.parse(await req.json());
    const parsed = schema.parse(value);
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await publishSetting(key, parsed, { id: admin.id, ip }));
  });
}
