import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { promptUpdateSchema } from "@/lib/admin-schemas";
import { updatePrompt, deletePrompt } from "@/server/admin/ai-admin-service";

/** PATCH /api/admin/prompts/:id — edit (content change bumps version). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = promptUpdateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updatePrompt(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/prompts/:id — delete if unused (audited). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deletePrompt(id, { id: admin.id, ip }));
  });
}
