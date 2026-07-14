import { redirect } from "next/navigation";
import { FEATURES } from "@/config/features";
import { FeedbackPanel } from "@/components/admin/feedback-panel";

export default function AdminFeedbackPage() {
  if (!FEATURES.aiAdmin) redirect("/admin/dashboard");
  return <FeedbackPanel />;
}
