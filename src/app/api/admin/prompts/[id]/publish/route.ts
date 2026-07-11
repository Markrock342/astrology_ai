import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/rbac";
import { promptUpdateSchema } from "@/lib/admin-schemas";
import { publishPrompt, assertAiAdminEnabled } from "@/server/admin/ai-admin-service";

/** POST /api/admin/prompts/:id/publish */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = promptUpdateSchema.parse(await req.json());
    if (!data.content) throw new AppError("VALIDATION", "content required");
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await publishPrompt(id, { ...data, content: data.content }, { id: admin.id, ip }));
  });
}
