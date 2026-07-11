import { getMe } from "@/server/user/account-service";
import { listPublicCategories } from "@/server/horoscope/category-service";
import {
  listNatalThreads,
  listTransitThreads,
} from "@/server/horoscope/thread-service";
import { getActiveAnnouncements } from "@/server/settings/settings-service";

/** One round-trip payload for the authenticated app shell. */
export async function getAppBootstrap(userId: string) {
  const [me, categories, natalThreads, transitThreads, announcements] =
    await Promise.all([
      getMe(userId),
      listPublicCategories(),
      listNatalThreads(userId),
      listTransitThreads(userId),
      getActiveAnnouncements().catch(() => []),
    ]);

  return {
    me,
    categories,
    natalThreads,
    transitThreads,
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      tone: a.tone,
      linkUrl: a.linkUrl,
      linkLabel: a.linkLabel,
    })),
  };
}

export type AppBootstrapData = Awaited<ReturnType<typeof getAppBootstrap>>;

/** JSON-safe bootstrap for RSC → client (Dates → ISO strings). */
export function serializeAppBootstrap(data: AppBootstrapData) {
  return JSON.parse(JSON.stringify(data)) as AppBootstrapData;
}
