import "@/server/horoscope/engine/taksa-boundaries";
import { topicHousesOf } from "@/lib/question-topics";
import { pastEventStartAge } from "@/lib/reading-intent";
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
  /** The question is about something that already happened: walk the years lived only. */
  past?: boolean;
  /** About a partner or love: weigh ปัตนิ and ปุตตะ. */
  relationship?: boolean;
  /** พ.ศ. years the user already said were wrong: left out of the list. */
  rejectedYears?: number[];
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
  const focus = topicHousesOf(input.question);
  const topicHouses = input.relationship
    ? [7, 5, 1]
    : focus.length
      ? focus
      : [...new Set(keys.flatMap((k) => input.memory?.categories[k]?.houses ?? []))];

  // A whole-life question walks to age 90; others the next 20 years.
  const wholeLife = timelineIncludesPast(input.question) || /ทั้งชีวิต|ตลอดชีวิต|ชั่วชีวิต|บั้นปลาย|แก่ตัว/.test(input.question);
  const lastDay = new Date(Date.UTC(birth.year + LAST_AGE, birth.month - 1, 1));
  const ahead = new Date(Date.UTC(now.getUTCFullYear() + DEFAULT_YEARS_AHEAD, now.getUTCMonth(), 1));
  const to = wholeLife || ahead.getTime() > lastDay.getTime() ? lastDay : ahead;
  const born = new Date(Date.UTC(birth.year, birth.month - 1, 1));
  // "ทั้งชีวิต" asks how a life goes on, not what happened at age one; only an
  // explicit look back (ที่ผ่านมา / ย้อนหลัง / ตอนเด็ก …) starts at birth.
  const lookBack = input.past || /ที่ผ่านมา|ย้อนหลัง|ย้อนไป|เคยผ่าน|ตอนเด็ก|วัยเด็ก/.test(input.question);
  // Something that already happened: from the teens (a love or a job before
  // that is rare) to this month, never after it.
  const from = input.past
    ? new Date(Date.UTC(birth.year + pastEventStartAge(input.question), birth.month - 1, 1))
    : lookBack
      ? born
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const until = input.past ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : to;
  if (from.getTime() >= until.getTime()) return null;

  const timeline = scanLifeTimeline({
    natalLagna: input.natal.chart?.lagna ?? input.natal.meta.lagna,
    natalPlanets: input.natal.planets,
    birth,
    from,
    to: until,
    now,
    topicHouses: topicHouses.length ? topicHouses : WHOLE_LIFE_HOUSES,
    // A lifetime has more turning points than twenty years.
    limit: (wholeLife ? 20 : 12) + (input.rejectedYears?.length ? 8 : 0),
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
  if (!timeline) return null;
  const rejected = new Set(input.rejectedYears ?? []);
  const kept = rejected.size
    ? { ...timeline, events: timeline.events.filter((e) => !rejected.has(e.at.getUTCFullYear() + 543)) }
    : timeline;
  const lines = formatLifeTimelineForPrompt(kept, { past: input.past });
  if (rejected.size) {
    lines.splice(
      2,
      0,
      `ผู้ใช้บอกแล้วว่าช่วงปี พ.ศ. ${[...rejected].join(", ")} ที่ตอบไปไม่ใช่ — ตัดออกจากรายการแล้ว ห้ามตอบปีเหล่านี้อีก ให้เลือกช่วงใหม่จากรายการด้านล่าง`,
    );
  }
  return lines.join("\n");
}
