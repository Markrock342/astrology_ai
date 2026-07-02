import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { knowledgeUpdateSchema } from "@/lib/admin-schemas";
import { updateKnowledgeDoc, deleteKnowledgeDoc } from "@/server/admin/ai-admin-service";

/** PATCH /api/admin/knowledge/:id — update a knowledge doc (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = knowledgeUpdateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updateKnowledgeDoc(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/knowledge/:id — delete a knowledge doc (audited). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteKnowledgeDoc(id, { id: admin.id, ip }));
  });
}
