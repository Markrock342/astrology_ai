import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  getNatalChart,
  upgradeNatalChartFromScrape,
} from "@/server/horoscope/natal-chart-service";
import { requireReadyNatalChart } from "@/server/horoscope/chart-context";
import type { ChartJson } from "@/types/chart";

/** Return a usable saved chart; repairs missing/stale charts synchronously. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    await requireReadyNatalChart(user.id);
    let chart = await getNatalChart(user.id);
    const chartJson = chart?.chartJson as unknown as ChartJson | undefined;

    // The reference page must not briefly return the fast sign-only cache and
    // replace it later. Wait for the detailed Samrap/MyHora evidence here;
    // chat creation remains fast and still upgrades in the background.
    if (
      chart?.birthProfileId &&
      chartJson?.meta?.calculationSource !== "myhora-scrape"
    ) {
      try {
        await upgradeNatalChartFromScrape(user.id, chart.birthProfileId);
        chart = await getNatalChart(user.id);
      } catch (error) {
        console.warn(
          "[natal] reference scrape upgrade failed; returning verified local chart:",
          error instanceof Error ? error.message : error,
        );
      }
    }
    return ok({ chart });
  });
}
