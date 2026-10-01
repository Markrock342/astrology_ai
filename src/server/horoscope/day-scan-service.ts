import type { ChartJson } from "@/types/chart";
import type { UserChartMemoryJson } from "@/types/chart-memory";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { resolveMemoryFocusKeys } from "@/server/horoscope/engine/derive-chart-memory";
import { computeTaksaFromBirth } from "@/lib/taksa";
import { dayScanDates } from "@/lib/reading-intent";
import { formatDayScanForPrompt, scanDays } from "@/lib/day-scan";

/** When the question names no life area, the houses most day-picks are about. */
const GENERAL_HOUSES = [1, 10, 11];

/**
 * The days of the asked period, walked one by one against the person's chart
 * (see lib/day-scan). Positions come from the local engine — the same Thai
 * 100-year ephemeris as the rest — at the person's birthplace, 09:00.
 */
export function buildDayScanPrompt(input: {
  natal: ChartJson;
  memory: UserChartMemoryJson | null;
  question: string;
  categorySlug: string;
  pinnedDate?: string | Date | null;
  now?: Date;
}): string | null {
  const birth = input.natal.input;
  const place = { country: birth.country, province: birth.province, district: birth.district };
  const keys = input.memory
    ? resolveMemoryFocusKeys({ categorySlug: input.categorySlug, question: input.question }) ?? []
    : [];
  const topicHouses = [...new Set(keys.flatMap((k) => input.memory?.categories[k]?.houses ?? []))];

  const { days, truncated } = dayScanDates(input.question, input.now, input.pinnedDate);
  const bkk = (d: Date) => new Date(d.getTime() + 7 * 3_600_000);
  const scan = scanDays({
    natalLagna: input.natal.chart?.lagna ?? input.natal.meta.lagna,
    natalPlanets: input.natal.planets,
    natalTaksa: input.natal.chart?.taksa?.length ? input.natal.chart.taksa : computeTaksaFromBirth(birth),
    topicHouses: topicHouses.length ? topicHouses : GENERAL_HOUSES,
    days,
    truncated,
    positionsAt: (at) =>
      computeNatalChartFormula({
        ...place,
        day: bkk(at).getUTCDate(),
        month: bkk(at).getUTCMonth() + 1,
        year: bkk(at).getUTCFullYear(),
        time: "09:00",
      }).planets,
  });
  return scan ? formatDayScanForPrompt(scan).join("\n") : null;
}
