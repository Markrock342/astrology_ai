import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import { getAiStatus } from "@/server/admin/ai-status-service";

/** GET /api/admin/ai-status — Google incidents + usage stats + cached health checks. */
export async function GET() {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    return ok(await getAiStatus());
  });
}
