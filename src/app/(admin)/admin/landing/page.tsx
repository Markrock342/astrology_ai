import { LandingManager } from "@/components/admin/landing-manager";
import { CMS_DEFAULTS, LANDING_CMS_KEYS } from "@/lib/cms-keys";
import { requireAdmin } from "@/server/auth/rbac";
import { listSettingsAdmin } from "@/server/admin/settings-admin-service";

export default async function AdminLandingPage() {
  await requireAdmin();

  let landingRows: Awaited<ReturnType<typeof listSettingsAdmin>> = [];
  try {
    const rows = await listSettingsAdmin();
    landingRows = rows.filter((r) =>
      LANDING_CMS_KEYS.includes(r.key as (typeof LANDING_CMS_KEYS)[number]),
    );
  } catch (err) {
    console.error("[admin/landing] settings load failed:", err);
    landingRows = LANDING_CMS_KEYS.map((key) => ({
      key,
      published: CMS_DEFAULTS[key],
      draft: null,
      hasDraft: false,
      value: CMS_DEFAULTS[key],
      updatedAt: null,
      draftUpdatedAt: null,
      isDefault: true,
    }));
  }

  return (
    <LandingManager
      initialRows={JSON.parse(JSON.stringify(landingRows)) as never}
    />
  );
}
