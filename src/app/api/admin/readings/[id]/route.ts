import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getReadingTrace } from "@/server/admin/reading-trace-admin-service";

/** GET /api/admin/readings/:id — full trace (charts, window, doctrine, prompts) + checks. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getReadingTrace(id));
  });
}
