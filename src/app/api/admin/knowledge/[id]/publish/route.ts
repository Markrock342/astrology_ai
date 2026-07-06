import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { knowledgeCreateSchema } from "@/lib/admin-schemas";
import { publishKnowledgeDoc, assertAiAdminEnabled } from "@/server/admin/ai-admin-service";

/** POST /api/admin/knowledge/:id/publish */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = knowledgeCreateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await publishKnowledgeDoc(id, data, { id: admin.id, ip }));
  });
}
