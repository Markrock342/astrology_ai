import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { promptCreateSchema } from "@/lib/admin-schemas";
import { listPrompts, createPrompt } from "@/server/admin/ai-admin-service";

/** GET /api/admin/prompts — list all prompt templates. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await listPrompts());
  });
}

/** POST /api/admin/prompts — create a prompt template (audited). */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = promptCreateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createPrompt(data, { id: admin.id, ip }), { status: 201 });
  });
}
