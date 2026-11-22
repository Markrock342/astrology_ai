import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { PlanetStandardsManager } from "@/components/admin/planet-standards-manager";
import { requireAdmin } from "@/server/auth/rbac";

export default async function AdminPlanetStandardsPage() {
  await requireAdmin();
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <PlanetStandardsManager />;
}
