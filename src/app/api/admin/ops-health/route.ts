import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getOpsHealth } from "@/server/admin/ops-health-service";

/** GET /api/admin/ops-health — live DB health + env readiness, without secrets. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await getOpsHealth());
  });
}
