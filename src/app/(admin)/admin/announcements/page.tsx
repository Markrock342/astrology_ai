import { AnnouncementsManager } from "@/components/admin/announcements-manager";
import { requireAdmin } from "@/server/auth/rbac";
import { listAnnouncements } from "@/server/admin/cms-content-admin-service";

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const items = await listAnnouncements();
  return (
    <AnnouncementsManager
      initialItems={JSON.parse(JSON.stringify(items)) as never}
    />
  );
}
