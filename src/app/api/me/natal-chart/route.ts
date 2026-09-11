import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  ensureNatalChartScrapeFirst,
  getNatalChart,
} from "@/server/horoscope/natal-chart-service";

/** Return a scrape-first saved chart; repairs missing/stale charts synchronously. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    await ensureNatalChartScrapeFirst(user.id);
    const chart = await getNatalChart(user.id);
    return ok({ chart });
  });
}
