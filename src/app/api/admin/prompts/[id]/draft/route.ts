import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/rbac";
import { promptUpdateSchema } from "@/lib/admin-schemas";
import { savePromptDraft, assertAiAdminEnabled } from "@/server/admin/ai-admin-service";

/** PUT /api/admin/prompts/:id/draft */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertAiAdminEnabled();
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = promptUpdateSchema.parse(await req.json());
    if (!data.content) throw new AppError("VALIDATION", "content required");
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await savePromptDraft(
        id,
        {
          content: data.content,
          name: data.name,
          type: data.type,
          enabled: data.enabled,
        },
        { id: admin.id, ip },
      ),
    );
  });
}
