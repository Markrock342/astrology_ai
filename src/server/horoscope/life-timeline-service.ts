import "@/server/horoscope/engine/taksa-boundaries";
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
 * How far a life timeline reaches: to age 90. It used to stop at 2583 (2040),
 * where the Thai 100-year table ends, because the formula behind it had Rahu
 * wrong in every month. With Rahu and Ketu fixed, the formula's slow planets
 * agree with the table month by month — ราหู 98%, พฤหัส 95%, เสาร์ 87%,
 * มฤตยู 84% over 1,200 months — the misses being the month a planet changes
 * sign. Events outside the table are marked so the answer can say a date
 * there may shift by a few months.
 */
const LAST_AGE = 90;
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

  // A whole-life question walks to age 90; others the next 20 years.
  const wholeLife = timelineIncludesPast(input.question) || /ทั้งชีวิต|ตลอดชีวิต|ชั่วชีวิต|บั้นปลาย|แก่ตัว/.test(input.question);
  const lastDay = new Date(Date.UTC(birth.year + LAST_AGE, birth.month - 1, 1));
  const ahead = new Date(Date.UTC(now.getUTCFullYear() + DEFAULT_YEARS_AHEAD, now.getUTCMonth(), 1));
  const to = wholeLife || ahead.getTime() > lastDay.getTime() ? lastDay : ahead;
  const born = new Date(Date.UTC(birth.year, birth.month - 1, 1));
  // "ทั้งชีวิต" asks how a life goes on, not what happened at age one; only an
  // explicit look back (ที่ผ่านมา / ย้อนหลัง / ตอนเด็ก …) starts at birth.
  const lookBack = /ที่ผ่านมา|ย้อนหลัง|ย้อนไป|เคยผ่าน|ตอนเด็ก|วัยเด็ก/.test(input.question);
  const from = lookBack
    ? born
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
    // A lifetime has more turning points than twenty years.
    limit: wholeLife ? 20 : 12,
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
