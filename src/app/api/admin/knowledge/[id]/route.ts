import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { knowledgeUpdateSchema } from "@/lib/admin-schemas";
import {
  updateKnowledgeDoc,
  deleteKnowledgeDoc,
  getKnowledgeDocById,
  assertAiAdminEnabled,
} from "@/server/admin/ai-admin-service";

/** GET /api/admin/knowledge/:id — full body for editor. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getKnowledgeDocById(id));
  });
}

/** PATCH /api/admin/knowledge/:id — update a knowledge doc (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
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
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteKnowledgeDoc(id, { id: admin.id, ip }));
  });
}
