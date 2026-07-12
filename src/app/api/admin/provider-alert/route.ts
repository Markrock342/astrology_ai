import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { assertAiAdminEnabled } from "@/server/admin/ai-admin-service";
import { getProviderAlertOnly } from "@/server/admin/ai-status-service";

/** GET /api/admin/provider-alert — critical Gemini billing/quota banner data. */
export async function GET() {
  return handle(async () => {
    assertAiAdminEnabled();
    await requireAdmin();
    return ok({ alert: await getProviderAlertOnly() });
  });
}
