import { SettingsManager } from "@/components/admin/settings-manager";
import { requireAdmin } from "@/server/auth/rbac";
import { listSettingsAdmin } from "@/server/admin/settings-admin-service";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const rows = await listSettingsAdmin();
  return (
    <SettingsManager initialRows={JSON.parse(JSON.stringify(rows)) as never} />
  );
}
