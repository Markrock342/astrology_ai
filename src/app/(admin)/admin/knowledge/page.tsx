import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { KnowledgeManager } from "@/components/admin/knowledge-manager";

export default function AdminKnowledgePage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <KnowledgeManager />;
}
