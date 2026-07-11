import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getMe } from "@/server/user/account-service";
import { listPublicCategories } from "@/server/horoscope/category-service";
import {
  listNatalThreads,
  listTransitThreads,
} from "@/server/horoscope/thread-service";

/**
 * One round-trip for the authenticated shell sidebar:
 * me + categories + natal/transit threads.
 * Avoids 4 separate serverless cold-starts on every app load.
 */
export async function GET() {
  return handle(async () => {
    const sessionUser = await requireUser();
    const [me, categories, natalThreads, transitThreads] = await Promise.all([
      getMe(sessionUser.id),
      listPublicCategories(),
      listNatalThreads(sessionUser.id),
      listTransitThreads(sessionUser.id),
    ]);
    return ok({ me, categories, natalThreads, transitThreads });
  });
}
