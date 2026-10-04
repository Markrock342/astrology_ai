import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { knowledgeCreateSchema } from "@/lib/admin-schemas";
import { saveKnowledgeDraft, assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import { clientIp } from "@/lib/rate-limit";

/** PUT /api/admin/knowledge/:id/draft */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = knowledgeCreateSchema.pick({ title: true, content: true }).parse(await req.json());
    const ip = clientIp(req);
    return ok(await saveKnowledgeDraft(id, data, { id: admin.id, ip }));
  });
}
