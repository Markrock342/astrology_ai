import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { AiConfigsManager } from "@/components/admin/ai-configs-manager";

export default function AdminAiConfigsPage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <AiConfigsManager />;
}
