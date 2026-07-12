import { FaqManager } from "@/components/admin/faq-manager";
import { requireAdmin } from "@/server/auth/rbac";
import { listFaqItemsAdminSummary } from "@/server/admin/cms-content-admin-service";

export default async function AdminFaqPage() {
  await requireAdmin();
  const items = await listFaqItemsAdminSummary();
  return <FaqManager initialItems={JSON.parse(JSON.stringify(items)) as never} />;
}
