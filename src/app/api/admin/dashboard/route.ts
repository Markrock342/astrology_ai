import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getDashboardStats } from "@/server/admin/dashboard-admin-service";

/** GET /api/admin/dashboard — aggregated KPI stats + recent admin activity. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await getDashboardStats());
  });
}
