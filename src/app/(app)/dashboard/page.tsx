import { ChatView } from "@/components/app/chat-view";

/**
 * Main app surface = chat (design 03/05). The selected category comes from the
 * `?cat=` query set by the sidebar; empty state shows the intro + suggested
 * questions.
 *
 * Natal wheel is not pinned above chat — it lives in EmptyState / per-message
 * so it does not eat the viewport while scrolling threads.
 */
export default function DashboardPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatView />
    </div>
  );
}
