import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { packExpiryRuleSchema } from "@/lib/admin-schemas";
import { getDefaultPackExpiry, setDefaultPackExpiry } from "@/server/catalog/question-pack-service";
import { clientIp } from "@/lib/rate-limit";

/** GET /api/admin/packages/default-expiry — when packs set to «ค่าเริ่มต้น» expire. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await getDefaultPackExpiry());
  });
}

/** PUT /api/admin/packages/default-expiry — change it for every such pack (audited). */
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const rule = packExpiryRuleSchema.parse(await req.json());
    const saved =
      rule.mode === "DATE" ? { mode: "DATE" as const, date: new Date(rule.date).toISOString() } : rule;
    return ok(await setDefaultPackExpiry(saved, { id: admin.id, ip: clientIp(req) }));
  });
}
