import { unstable_cache } from "next/cache";
import { AppError } from "@/lib/errors";
import { getMe } from "@/server/user/account-service";
import { listPublicCategories } from "@/server/horoscope/category-service";
import {
  listNatalThreads,
  listTransitThreads,
} from "@/server/horoscope/thread-service";
import { getActiveAnnouncements } from "@/server/settings/settings-service";
import { prisma } from "@/server/db";

/** Sidebar thread cap — keeps bootstrap payloads bounded. */
export const BOOTSTRAP_THREAD_LIMIT = 30;

const getCachedAnnouncements = unstable_cache(
  () => getActiveAnnouncements().catch(() => []),
  ["active-announcements"],
  { revalidate: 60 },
);

function settled<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  opts?: { rethrowAppNotFound?: boolean },
): T {
  if (result.status === "fulfilled") return result.value;
  const reason = result.reason;
  if (
    opts?.rethrowAppNotFound &&
    reason instanceof AppError &&
    reason.code === "NOT_FOUND"
  ) {
    throw reason;
  }
  console.error("[bootstrap] partial failure:", reason);
  return fallback;
}

/** One round-trip payload for the authenticated app shell. */
export async function getAppBootstrap(userId: string) {
  const [
    meResult,
    categoriesResult,
    natalThreadsResult,
    transitThreadsResult,
    announcementsResult,
    pendingPaymentResult,
    natalChartStatusResult,
  ] = await Promise.allSettled([
    getMe(userId),
    listPublicCategories(),
    listNatalThreads(userId, BOOTSTRAP_THREAD_LIMIT),
    listTransitThreads(userId, BOOTSTRAP_THREAD_LIMIT),
    getCachedAnnouncements(),
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
    prisma.natalChart.findUnique({
      where: { userId },
      select: { status: true, note: true },
    }),
  ]);

  const me = settled(meResult, null as never, { rethrowAppNotFound: true });
  const categories = settled(categoriesResult, []);
  const natalThreads = settled(natalThreadsResult, []);
  const transitThreads = settled(transitThreadsResult, []);
  const announcements = settled(announcementsResult, []);
  const pendingPayment = settled(pendingPaymentResult, null);
  const natalChartStatus = settled(natalChartStatusResult, null);

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
    natalChartStatus: natalChartStatus
      ? { status: natalChartStatus.status, note: natalChartStatus.note }
      : null,
  };
}

/** Cached shell bootstrap — avoids re-querying on every in-app navigation. */
export function getCachedAppBootstrap(userId: string) {
  return unstable_cache(
    () => getAppBootstrap(userId),
    ["app-bootstrap", userId],
    { revalidate: 15, tags: [`bootstrap-${userId}`] },
  )();
}

/** Lightweight refresh after chat/payment — me + thread lists only. */
export async function getAppBootstrapLight(userId: string) {
  const [meResult, natalThreadsResult, transitThreadsResult] =
    await Promise.allSettled([
      getMe(userId),
      listNatalThreads(userId, BOOTSTRAP_THREAD_LIMIT),
      listTransitThreads(userId, BOOTSTRAP_THREAD_LIMIT),
    ]);

  const me = settled(meResult, null as never, { rethrowAppNotFound: true });
  const natalThreads = settled(natalThreadsResult, []);
  const transitThreads = settled(transitThreadsResult, []);

  return { me, natalThreads, transitThreads };
}

export type AppBootstrapData = Awaited<ReturnType<typeof getAppBootstrap>>;

/** JSON-safe bootstrap for RSC → client (Dates → ISO strings). */
export function serializeAppBootstrap(data: AppBootstrapData) {
  return JSON.parse(JSON.stringify(data)) as AppBootstrapData;
}
