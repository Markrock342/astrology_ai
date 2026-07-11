import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { listSettingsAdmin } from "@/server/admin/settings-admin-service";

/** GET /api/admin/settings — all CMS keys with current values. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await listSettingsAdmin());
  });
}
