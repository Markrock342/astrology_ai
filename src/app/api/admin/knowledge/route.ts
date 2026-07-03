import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { knowledgeCreateSchema } from "@/lib/admin-schemas";
import {
  listKnowledgeDocs,
  createKnowledgeDoc,
  assertAiAdminEnabled,
} from "@/server/admin/ai-admin-service";

/** GET /api/admin/knowledge — list all knowledge docs. */
export async function GET() {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    return ok(await listKnowledgeDocs());
  });
}

/** POST /api/admin/knowledge — create a knowledge doc (audited). */
export async function POST(req: Request) {
  return handle(async () => {
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const data = knowledgeCreateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createKnowledgeDoc(data, { id: admin.id, ip }), { status: 201 });
  });
}
