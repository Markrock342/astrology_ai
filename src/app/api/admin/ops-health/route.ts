import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getOpsHealth } from "@/server/admin/ops-health-service";

/** GET /api/admin/ops-health — boolean env readiness (no secret values). */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(getOpsHealth());
  });
}
