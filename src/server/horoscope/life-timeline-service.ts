import type { ChartJson } from "@/types/chart";
import type { UserChartMemoryJson } from "@/types/chart-memory";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { resolveMemoryFocusKeys } from "@/server/horoscope/engine/derive-chart-memory";
import { computeTransitTaksaByAge } from "@/lib/taksa";
import { timelineIncludesPast } from "@/lib/reading-intent";
import {
  formatLifeTimelineForPrompt,
  scanLifeTimeline,
} from "@/lib/life-timeline";

/**
 * The Thai 100-year ephemeris in the engine covers พ.ศ. 2484–2583
 * (1941–2040). Past it the engine falls back to a modern Lahiri formula, which
 * is a different system: checked across the overlap, it agrees with the Thai
 * table on Saturn 89% of the time, Rahu 0% and Ketu 8%. A timeline built on it
 * would date turning points in the wrong year, so the window stops here.
 */
const EPHEMERIS_FIRST = new Date(Date.UTC(1941, 0, 1));
const EPHEMERIS_LAST = new Date(Date.UTC(2040, 11, 1));
const DEFAULT_YEARS_AHEAD = 20;

/** When the question names no life area, the houses that shape a life. */
const WHOLE_LIFE_HOUSES = [1, 10, 7, 2, 11];

export function buildLifeTimelinePrompt(input: {
  natal: ChartJson;
  memory: UserChartMemoryJson | null;
  question: string;
  categorySlug: string;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const birth = input.natal.input;
  const place = {
    country: birth.country,
    province: birth.province,
    district: birth.district,
  };

  const keys = input.memory
    ? resolveMemoryFocusKeys({ categorySlug: input.categorySlug, question: input.question }) ?? []
    : [];
  const topicHouses = [
    ...new Set(keys.flatMap((k) => input.memory?.categories[k]?.houses ?? [])),
  ];

  const ahead = new Date(Date.UTC(now.getUTCFullYear() + DEFAULT_YEARS_AHEAD, now.getUTCMonth(), 1));
  const to = ahead.getTime() < EPHEMERIS_LAST.getTime() ? ahead : EPHEMERIS_LAST;
  const born = new Date(Date.UTC(birth.year, birth.month - 1, 1));
  const from = timelineIncludesPast(input.question)
    ? new Date(Math.max(born.getTime(), EPHEMERIS_FIRST.getTime()))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (from.getTime() >= to.getTime()) return null;

  const timeline = scanLifeTimeline({
    natalLagna: input.natal.chart?.lagna ?? input.natal.meta.lagna,
    natalPlanets: input.natal.planets,
    birth,
    from,
    to,
    now,
    topicHouses: topicHouses.length ? topicHouses : WHOLE_LIFE_HOUSES,
    // Mid-month, noon: the slow planets' sign for that month.
    positionsAt: (at) =>
      computeNatalChartFormula({
        ...place,
        day: 15,
        month: at.getUTCMonth() + 1,
        year: at.getUTCFullYear(),
        time: "12:00",
      }).planets,
    taksaAt: (at) =>
      Object.fromEntries(
        computeTransitTaksaByAge(birth, new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 15)))
          .slots.filter((slot) => slot.planet && slot.taksa)
          .map((slot) => [slot.planet, slot.taksa]),
      ),
  });
  return timeline ? formatLifeTimelineForPrompt(timeline).join("\n") : null;
}
