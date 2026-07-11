import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { listRevisions } from "@/server/admin/content-revision-service";

const querySchema = z.object({
  entityType: z.enum(["APP_SETTING", "PROMPT_TEMPLATE", "KNOWLEDGE_DOC", "FAQ_ITEM"]),
  entityId: z.string().min(1),
});

/** GET /api/admin/revisions?entityType=&entityId= */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const { entityType, entityId } = querySchema.parse({
      entityType: url.searchParams.get("entityType"),
      entityId: url.searchParams.get("entityId"),
    });
    const rows = await listRevisions(entityType, entityId);
    return ok(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  });
}
