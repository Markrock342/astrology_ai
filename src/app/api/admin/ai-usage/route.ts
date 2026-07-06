import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { aiUsageQuerySchema } from "@/lib/admin-schemas";
import { listAiUsage } from "@/server/admin/log-admin-service";

/** GET /api/admin/ai-usage — paginated AI usage logs (tokens/latency/errors). */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = aiUsageQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await listAiUsage(q));
  });
}
