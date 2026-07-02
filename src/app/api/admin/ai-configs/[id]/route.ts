import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { aiConfigUpdateSchema } from "@/lib/admin-schemas";
import { updateAIConfig, deleteAIConfig } from "@/server/admin/ai-admin-service";

/** PATCH /api/admin/ai-configs/:id — update a config (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = aiConfigUpdateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updateAIConfig(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/ai-configs/:id — delete if unused (audited). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteAIConfig(id, { id: admin.id, ip }));
  });
}
