import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { revisionRestoreSchema } from "@/lib/admin-schemas";
import { requireAdmin } from "@/server/auth/rbac";
import { getRevision } from "@/server/admin/content-revision-service";
import { restoreSettingRevision } from "@/server/admin/settings-admin-service";
import {
  restorePromptRevision,
  restoreKnowledgeRevision,
} from "@/server/admin/ai-admin-service";
import { restoreFaqRevision } from "@/server/admin/cms-content-admin-service";

/** POST /api/admin/revisions/:id/restore */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { mode } = revisionRestoreSchema.parse(await req.json().catch(() => ({})));
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const actor = { id: admin.id, ip };

    const revision = await getRevision(id);
    if (!revision) throw new AppError("NOT_FOUND", "Revision not found");

    switch (revision.entityType) {
      case "APP_SETTING":
        return ok(await restoreSettingRevision(revision.entityId, id, actor, mode));
      case "PROMPT_TEMPLATE":
        return ok(await restorePromptRevision(revision.entityId, id, actor, mode));
      case "KNOWLEDGE_DOC":
        return ok(await restoreKnowledgeRevision(revision.entityId, id, actor, mode));
      case "FAQ_ITEM":
        return ok(await restoreFaqRevision(revision.entityId, id, actor, mode));
      default:
        throw new AppError("VALIDATION", "Unsupported entity type");
    }
  });
}
