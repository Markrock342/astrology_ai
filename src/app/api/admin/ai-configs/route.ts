import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { aiConfigCreateSchema } from "@/lib/admin-schemas";
import { listAIConfigs, createAIConfig } from "@/server/admin/ai-admin-service";

/** GET /api/admin/ai-configs — list all AI provider configs. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await listAIConfigs());
  });
}

/** POST /api/admin/ai-configs — create a config (audited). */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = aiConfigCreateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createAIConfig(data, { id: admin.id, ip }), { status: 201 });
  });
}
