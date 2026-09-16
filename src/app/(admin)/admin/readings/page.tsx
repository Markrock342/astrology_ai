import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { ReadingTracePanel } from "@/components/admin/reading-trace-panel";

export default function AdminReadingsPage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <ReadingTracePanel />;
}
