import { ChatView } from "@/components/app/chat-view";
import { NatalChartBanner } from "@/components/app/natal-chart-banner";

/**
 * Main app surface = chat (design 03/05). The selected category comes from the
 * `?cat=` query set by the sidebar; empty state shows the intro + suggested
 * questions.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <NatalChartBanner />
      <ChatView />
    </div>
  );
}
