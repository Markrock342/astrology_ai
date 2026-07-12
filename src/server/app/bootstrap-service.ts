import { getMe } from "@/server/user/account-service";
import { listPublicCategories } from "@/server/horoscope/category-service";
import {
  listNatalThreads,
  listTransitThreads,
} from "@/server/horoscope/thread-service";
import { getActiveAnnouncements } from "@/server/settings/settings-service";
import { prisma } from "@/server/db";

/** One round-trip payload for the authenticated app shell. */
export async function getAppBootstrap(userId: string) {
  const [me, categories, natalThreads, transitThreads, announcements, pendingPayment] =
    await Promise.all([
      getMe(userId),
      listPublicCategories(),
      listNatalThreads(userId),
      listTransitThreads(userId),
      getActiveAnnouncements().catch(() => []),
      prisma.payment.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),
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
    pendingPayment: pendingPayment
      ? {
          id: pendingPayment.id,
          amount: pendingPayment.amount,
          status: "PENDING" as const,
          createdAt: pendingPayment.createdAt.toISOString(),
        }
      : null,
  };
}

export type AppBootstrapData = Awaited<ReturnType<typeof getAppBootstrap>>;

/** JSON-safe bootstrap for RSC → client (Dates → ISO strings). */
export function serializeAppBootstrap(data: AppBootstrapData) {
  return JSON.parse(JSON.stringify(data)) as AppBootstrapData;
}
