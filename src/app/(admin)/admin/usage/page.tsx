import { ScaffoldNote } from "@/components/scaffold-note";

export default function AdminUsagePage() {
  return (
    <ScaffoldNote title="Admin · Usage / AI Logs" owner="Both">
      ตาราง ai_usage_logs: user · category · provider · model · prompt version ·
      status · usage metadata · ต้นทุนโดยประมาณ · latency · error.
    </ScaffoldNote>
  );
}
