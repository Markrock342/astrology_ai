import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { ScaffoldNote } from "@/components/scaffold-note";

export default function AdminUsagePage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return (
    <ScaffoldNote title="Admin · Usage / AI Logs" owner="Both">
      ตาราง ai_usage_logs: user · category · provider · model · prompt version ·
      status · usage metadata · ต้นทุนโดยประมาณ · latency · error.
    </ScaffoldNote>
  );
}
