import "@/server/horoscope/engine/taksa-boundaries";
import { topicHousesOf } from "@/lib/question-topics";
import type { ChartJson } from "@/types/chart";
import type { UserChartMemoryJson } from "@/types/chart-memory";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { resolveMemoryFocusKeys } from "@/server/horoscope/engine/derive-chart-memory";
import { computeTaksaFromBirth } from "@/lib/taksa";
import { dayScanDates } from "@/lib/reading-intent";
import { formatDayCheckForPrompt, formatDayScanForPrompt, scanDays } from "@/lib/day-scan";

/** When the question names no life area, the houses most day-picks are about. */
const GENERAL_HOUSES = [1, 10, 11];

/** Each day's facts for a person's chart (09:00 Bangkok at the birthplace). */
export function scanDaysForChart(input: {
  natal: ChartJson;
  days: Date[];
  topicHouses: number[];
}) {
  const birth = input.natal.input;
  const place = { country: birth.country, province: birth.province, district: birth.district };
  const bkk = (d: Date) => new Date(d.getTime() + 7 * 3_600_000);
  return scanDays({
    natalLagna: input.natal.chart?.lagna ?? input.natal.meta.lagna,
    natalPlanets: input.natal.planets,
    natalTaksa: input.natal.chart?.taksa?.length ? input.natal.chart.taksa : computeTaksaFromBirth(birth),
    topicHouses: input.topicHouses.length ? input.topicHouses : GENERAL_HOUSES,
    days: input.days,
    keepAll: true,
    positionsAt: (at) =>
      computeNatalChartFormula({
        ...place,
        day: bkk(at).getUTCDate(),
        month: bkk(at).getUTCMonth() + 1,
        year: bkk(at).getUTCFullYear(),
        time: "09:00",
      }).planets,
  });
}

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
  /** Check this one day (09:00 Bangkok) against the week around it instead. */
  checkDay?: string | Date | null;
  /** False: the lagna is a noon guess — days are judged without houses. */
  birthTimeKnown?: boolean;
}): string | null {
  const birth = input.natal.input;
  const place = { country: birth.country, province: birth.province, district: birth.district };
  const keys = input.memory
    ? resolveMemoryFocusKeys({ categorySlug: input.categorySlug, question: input.question }) ?? []
    : [];
  // The [question_focus] table decides first, so the day list and the focus
  // line agree (a contract question was "ภพ 3" in one and "ภพ 10, 11" in the other).
  const focus = topicHousesOf(input.question);
  const topicHouses = focus.length ? focus : [...new Set(keys.flatMap((k) => input.memory?.categories[k]?.houses ?? []))];

  const checkDay = input.checkDay ? new Date(input.checkDay) : null;
  const bkk = (d: Date) => new Date(d.getTime() + 7 * 3_600_000);
  // The days around an asked day are offered as better ones "if you can
  // move it" — never a day already gone (asked about the 10th on the 7th,
  // the model was offered the 7th, and the 5th for an earlier day).
  const today = bkk(input.now ?? new Date()).toISOString().slice(0, 10);
  const { days, truncated } = checkDay
    ? {
        days: [-3, -2, -1, 0, 1, 2, 3, 4, 5]
          .map((k) => ({ k, at: new Date(checkDay.getTime() + k * 86_400_000) }))
          .filter(({ k, at }) => k === 0 || bkk(at).toISOString().slice(0, 10) > today)
          .map(({ at }) => at),
        truncated: false,
      }
    : dayScanDates(input.question, input.now, input.pinnedDate);
  const scan = scanDays({
    natalLagna: input.birthTimeKnown === false ? null : (input.natal.chart?.lagna ?? input.natal.meta.lagna),
    natalPlanets: input.natal.planets,
    natalTaksa: input.natal.chart?.taksa?.length ? input.natal.chart.taksa : computeTaksaFromBirth(birth),
    topicHouses: topicHouses.length ? topicHouses : GENERAL_HOUSES,
    days,
    truncated,
    keepAll: Boolean(checkDay),
    positionsAt: (at) =>
      computeNatalChartFormula({
        ...place,
        day: bkk(at).getUTCDate(),
        month: bkk(at).getUTCMonth() + 1,
        year: bkk(at).getUTCFullYear(),
        time: "09:00",
      }).planets,
  });
  if (!scan) return null;
  if (checkDay) {
    const lines = formatDayCheckForPrompt(scan, checkDay);
    return lines.length ? lines.join("\n") : null;
  }
  return formatDayScanForPrompt(scan).join("\n");
}
