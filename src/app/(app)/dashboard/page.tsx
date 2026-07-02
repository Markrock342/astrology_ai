import { ChatView } from "@/components/app/chat-view";

/**
 * Main app surface = chat (design 03/05). The selected category comes from the
 * `?cat=` query set by the sidebar; empty state shows the intro + suggested
 * questions.
 */
export default function DashboardPage() {
  return <ChatView />;
}
