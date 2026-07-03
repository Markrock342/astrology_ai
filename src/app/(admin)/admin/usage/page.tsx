import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { UsagePanel } from "@/components/admin/usage-panel";

export default function AdminUsagePage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <UsagePanel />;
}
