import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import { runConfigHealthChecks } from "@/server/admin/ai-status-service";

/** POST /api/admin/ai-status/health — run live health checks for all enabled configs. */
export async function POST() {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    return ok(await runConfigHealthChecks(true));
  });
}
