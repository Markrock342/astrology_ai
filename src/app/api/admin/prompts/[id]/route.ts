import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { promptUpdateSchema } from "@/lib/admin-schemas";
import {
  updatePrompt,
  deletePrompt,
  getPromptById,
  assertAiAdminEnabled,
} from "@/server/admin/ai-admin-service";
import { AppError } from "@/lib/errors";

/** GET /api/admin/prompts/:id — full body for editor. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    const { id } = await ctx.params;
    const row = await getPromptById(id);
    if (!row) throw new AppError("NOT_FOUND", "Prompt template not found");
    return ok(row);
  });
}

/** PATCH /api/admin/prompts/:id — edit (content change bumps version). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
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
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deletePrompt(id, { id: admin.id, ip }));
  });
}
