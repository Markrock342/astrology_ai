import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getCreditReport } from "@/server/admin/credit-report-service";

/** GET /api/admin/credit-report — where the tracked top-up went, call by call. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await getCreditReport());
  });
}
