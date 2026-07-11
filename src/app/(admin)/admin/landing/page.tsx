import { LandingManager } from "@/components/admin/landing-manager";
import { LANDING_CMS_KEYS } from "@/lib/cms-keys";
import { requireAdmin } from "@/server/auth/rbac";
import { listSettingsAdmin } from "@/server/admin/settings-admin-service";

export default async function AdminLandingPage() {
  await requireAdmin();
  const rows = await listSettingsAdmin();
  const landingRows = rows.filter((r) =>
    LANDING_CMS_KEYS.includes(r.key as (typeof LANDING_CMS_KEYS)[number]),
  );
  return (
    <LandingManager
      initialRows={JSON.parse(JSON.stringify(landingRows)) as never}
    />
  );
}
