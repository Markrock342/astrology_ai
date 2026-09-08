import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { AstrologyStandardsManager } from "@/components/admin/astrology-standards-manager";
import { requireAdmin } from "@/server/auth/rbac";

export default async function AdminAstrologyStandardsPage() {
  await requireAdmin();
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <AstrologyStandardsManager />;
}
