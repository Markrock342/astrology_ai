import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getRevision } from "@/server/admin/content-revision-service";

/** GET /api/admin/revisions/:id — full snapshot for diff/restore preview. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const row = await getRevision(id);
    if (!row) return ok(null);
    return ok({
      ...row,
      createdAt: row.createdAt.toISOString(),
    });
  });
}
