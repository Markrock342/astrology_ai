import { ChatView } from "@/components/app/chat-view";
import { CMS_DEFAULTS, CMS_KEYS, type CmsChatUi } from "@/lib/cms-keys";
import { getPublishedSetting } from "@/server/settings/settings-service";

/**
 * Main app surface = chat (design 03/05). The selected category comes from the
 * `?cat=` query set by the sidebar; empty state shows the intro + suggested
 * questions.
 *
 * Natal wheel is not pinned above chat — it lives in EmptyState / per-message
 * so it does not eat the viewport while scrolling threads.
 */
export default async function DashboardPage() {
  const chatUi = (await getPublishedSetting(CMS_KEYS.chatUi).catch(
    () => CMS_DEFAULTS[CMS_KEYS.chatUi],
  )) as CmsChatUi;
  return (
    <div className="flex flex-1 flex-col">
      <ChatView chatUi={chatUi} />
    </div>
  );
}
