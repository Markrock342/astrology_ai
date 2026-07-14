import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { CostPanel } from "@/components/admin/cost-panel";

export default function AdminCostsPage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <CostPanel />;
}
