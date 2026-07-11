import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { requireAdmin } from "@/server/auth/rbac";
import { getDashboardStats } from "@/server/admin/dashboard-admin-service";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getDashboardStats();
  return <DashboardOverview initialStats={stats} />;
}
