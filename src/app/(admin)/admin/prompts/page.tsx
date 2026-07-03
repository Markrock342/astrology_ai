import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { PromptsManager } from "@/components/admin/prompts-manager";

export default function AdminPromptsPage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <PromptsManager />;
}
