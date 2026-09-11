import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  ensureNatalChartScrapeFirst,
  getNatalChart,
} from "@/server/horoscope/natal-chart-service";

/** Repair + return natal chart status after scrape-first build. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    await ensureNatalChartScrapeFirst(user.id);
    const chart = await getNatalChart(user.id);
    return ok({
      status: chart?.status ?? "PENDING",
      note: chart?.note ?? null,
    });
  });
}
