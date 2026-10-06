import type { PlanetSignRow } from "@/types/chart";
import {
  aspectKindFromHouse,
  houseFromSign,
  type AspectKind,
} from "@/lib/chart-aspects";
import { HOUSE_MEANING, HOUSE_NAMES, normalizeSignName, SIGNS } from "@/lib/chart-theme";
import { lordOfSign } from "@/lib/thai-dignity";

/**
 * When will life turn? — answered from the sky, not guessed.
 *
 * A question like "ชีวิตจะพลิกตอนไหน อายุเท่าไหร่ ปีไหน" names no period, so it
 * used to be read as a natal question and the model was given no transit at
 * all; it either refused to date anything or made a year up. This walks the
 * slow planets month by month over a window, records every sign they enter
 * as a house of THIS natal chart, what they sit on or face there, and the
 * person's ทักษาจร that year, then scores the moments so the model can pick
 * the turning points — with dates it did not have to invent.
 */

/**
 * Planets that define periods of life. เกตุ is left out on purpose: in the Thai
 * system it is not the south node and it laps the zodiac in under two years —
 * on a real chart it re-entered the lagna seven times in twelve years and
 * crowded out every real turning point. มฤตยู is in: about seven years a sign,
 * and the planet Thai readings use for sudden reversals.
 */
export const SLOW_PLANETS = ["เสาร์", "พฤหัสบดี", "ราหู", "มฤตยู"] as const;
const PLANET_WEIGHT: Record<string, number> = {
  เสาร์: 3,
  พฤหัสบดี: 3,
  ราหู: 2,
  มฤตยู: 2,
};

export type PositionsAt = (date: Date) => PlanetSignRow[];
/** ทักษาจร role of each planet at a date, e.g. { เสาร์: "ศรีจร" }. */
export type TaksaAt = (date: Date) => Record<string, string>;

export type TimelineContact = { kind: AspectKind; body: string };

export type TimelineEvent = {
  /** First month the planet is found in the new sign. */
  at: Date;
  planet: string;
  sign: string;
  natalHouse: number;
  contacts: TimelineContact[];
  /** A retrograde step back to the old sign, and when it came back for good. */
  retreatedAt: Date | null;
  settledAt: Date | null;
  transitTaksa: string | null;
  /** Completed years of age at `at`. */
  age: number;
  score: number;
};

export type LifeTimeline = {
  from: Date;
  to: Date;
  now: { at: Date; age: number; positions: Array<{ planet: string; sign: string; natalHouse: number }> };
  events: TimelineEvent[];
};

function validSign(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = normalizeSignName(raw);
  return (SIGNS as readonly string[]).includes(s) ? s : null;
}

function signOfHouse(lagna: string, house: number): string {
  return SIGNS[((SIGNS as readonly string[]).indexOf(normalizeSignName(lagna)) + house - 1) % 12]!;
}

export function completedAge(birth: { day: number; month: number; year: number }, at: Date): number {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth() + 1;
  const d = at.getUTCDate();
  let age = y - birth.year;
  if (m < birth.month || (m === birth.month && d < birth.day)) age -= 1;
  return Math.max(0, age);
}

/** Month starts from `from` to `to`, inclusive, one every `step` months. */
function months(from: Date, to: Date, step: number): Date[] {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cur.getTime() <= to.getTime()) {
    out.push(new Date(cur));
    cur.setUTCMonth(cur.getUTCMonth() + step);
  }
  return out;
}

export function scanLifeTimeline(input: {
  natalLagna: string | null | undefined;
  natalPlanets: PlanetSignRow[];
  birth: { day: number; month: number; year: number };
  from: Date;
  to: Date;
  now: Date;
  /** Houses the question is about (e.g. career 10, 6, 2); they weigh more. */
  topicHouses: number[];
  positionsAt: PositionsAt;
  taksaAt?: TaksaAt;
  stepMonths?: number;
  limit?: number;
}): LifeTimeline | null {
  const lagna = validSign(input.natalLagna);
  if (!lagna) return null;

  const natal = input.natalPlanets
    .map((p) => ({ name: p.planet, sign: validSign(p.siderealSign) }))
    .filter((p): p is { name: string; sign: string } => Boolean(p.sign));
  const lagnaLord = lordOfSign(lagna);
  const topicLords = new Set(
    input.topicHouses.map((h) => lordOfSign(signOfHouse(lagna, h))).filter(Boolean) as string[],
  );

  const contactsFor = (sign: string): TimelineContact[] => {
    const out: TimelineContact[] = [];
    const lagnaKind = aspectKindFromHouse(houseFromSign(sign, lagna));
    if (lagnaKind) out.push({ kind: lagnaKind, body: "ลัคนา" });
    for (const body of natal) {
      const kind = aspectKindFromHouse(houseFromSign(sign, body.sign));
      if (!kind) continue;
      // Every natal planet it sits on; wider aspects only to the lords that matter.
      const matters = body.name === lagnaLord || topicLords.has(body.name);
      if (kind === "กุม" || kind === "เล็ง" || matters) out.push({ kind, body: body.name });
    }
    return out;
  };

  const score = (planet: string, house: number, contacts: TimelineContact[], taksa: string | null) => {
    let s = PLANET_WEIGHT[planet] ?? 1;
    if ([1, 4, 7, 10].includes(house)) s += 2;
    else if ([5, 9].includes(house)) s += 1;
    if (input.topicHouses.includes(house)) s += 2;
    for (const c of contacts) {
      const strong = c.kind === "กุม" || c.kind === "เล็ง";
      if (c.body === "ลัคนา") s += strong ? 3 : 1;
      else if (c.body === lagnaLord) s += strong ? 2 : 1;
      else if (topicLords.has(c.body)) s += strong ? 2 : 1;
      else if (strong) s += 1;
    }
    if (taksa && /ศรี|เดช|กาลกิณี|มนตรี/.test(taksa)) s += 1;
    return s;
  };

  const step = input.stepMonths ?? 1;
  const perPlanet = new Map<string, TimelineEvent[]>();
  // The sign each planet is in, and the one it was in before — tracked here
  // rather than read back from the event list, whose first entry may lie
  // before the window.
  const state = new Map<string, { current: string; before: string | null }>();
  for (const at of months(input.from, input.to, step)) {
    const rows = input.positionsAt(at);
    for (const planet of SLOW_PLANETS) {
      const sign = validSign(rows.find((r) => r.planet === planet)?.siderealSign);
      if (!sign) continue;
      const st = state.get(planet);
      if (!st) {
        state.set(planet, { current: sign, before: null });
        continue;
      }
      if (st.current === sign) continue;
      const moveTo = (next: string) => {
        st.before = st.current;
        st.current = next;
      };

      const list = perPlanet.get(planet) ?? [];
      const last = list.at(-1);
      // Retrograde wiggle: straight back into the sign it just left.
      if (
        last &&
        last.sign === st.current &&
        sign === st.before &&
        !last.retreatedAt &&
        monthsBetween(last.at, at) <= 12
      ) {
        last.retreatedAt = at;
        moveTo(sign);
        continue;
      }
      // …and forward again: the same entry, now for good.
      if (last && last.sign === sign && last.retreatedAt && !last.settledAt) {
        last.settledAt = at;
        moveTo(sign);
        continue;
      }
      moveTo(sign);
      const natalHouse = houseFromSign(lagna, sign);
      const contacts = contactsFor(sign);
      const transitTaksa = input.taksaAt?.(at)[planet] ?? null;
      list.push({
        at,
        planet,
        sign,
        natalHouse,
        contacts,
        retreatedAt: null,
        settledAt: null,
        transitTaksa,
        age: completedAge(input.birth, at),
        score: score(planet, natalHouse, contacts, transitTaksa),
      });
      perPlanet.set(planet, list);
    }
  }

  const all = [...perPlanet.values()].flat();
  const top = [...all]
    .sort((a, b) => b.score - a.score || a.at.getTime() - b.at.getTime())
    .slice(0, input.limit ?? 12)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const nowRows = input.positionsAt(input.now);
  return {
    from: input.from,
    to: input.to,
    now: {
      at: input.now,
      age: completedAge(input.birth, input.now),
      positions: SLOW_PLANETS.flatMap((planet) => {
        const sign = validSign(nowRows.find((r) => r.planet === planet)?.siderealSign);
        return sign ? [{ planet, sign, natalHouse: houseFromSign(lagna, sign) }] : [];
      }),
    },
    events: top,
  };
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "พ.ค. 2571" — Thai month, Buddhist year. */
export function thaiMonthYear(at: Date): string {
  return `${THAI_MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear() + 543}`;
}

function houseLabel(house: number): string {
  const name = HOUSE_NAMES[house - 1];
  return name ? `ภพ ${house} ${name} (${HOUSE_MEANING[name]})` : `ภพ ${house}`;
}

export function formatLifeTimelineForPrompt(t: LifeTimeline, opts: { past?: boolean } = {}): string[] {
  const lines = [
    `[timeline] จุดเปลี่ยนของชีวิตจากดาวจรเดินช้า ช่วง ${thaiMonthYear(t.from)} ถึง ${thaiMonthYear(t.to)} ` +
      "(คำนวณจากปฏิทินดาวสุริยยาตร์ทุกเดือนแล้ว ห้ามเดา — เดือน ปี และอายุที่ตอบต้องมาจากรายการนี้เท่านั้น):",
    `ผู้ถามอายุ ${t.now.age} ปีในวันนี้ (${thaiMonthYear(t.now.at)}) — ` +
      (opts.past
        ? `ทุกรายการด้านล่างเป็นอดีต (ก่อนวันนี้) ห้ามตอบเดือน ปี หรืออายุที่มากกว่า ${t.now.age} ปี`
        : `รายการที่อายุมากกว่า ${t.now.age} ปีคืออนาคต`),
    "ตำแหน่งดาวเดินช้าตอนนี้: " +
      t.now.positions
        .map((p) => `${p.planet}อยู่ราศี${p.sign} ภพ ${p.natalHouse} ${HOUSE_NAMES[p.natalHouse - 1] ?? ""}`)
        .join(" · "),
  ];
  // The model printed the raw score as "(น้ำหนัก 14)". The strongest third
  // are named instead; the number stays here.
  const scores = [...t.events.map((e) => e.score)].sort((a, b) => b - a);
  const bigFrom = scores[Math.max(0, Math.ceil(scores.length / 3) - 1)] ?? Infinity;
  if (!t.events.length) {
    lines.push("- ไม่มีดาวเดินช้าย้ายราศีในช่วงนี้");
    return lines;
  }
  for (const e of t.events) {
    const wiggle =
      e.retreatedAt && e.settledAt
        ? ` (ถอยกลับชั่วคราว ${thaiMonthYear(e.retreatedAt)} แล้วเข้าเต็มที่ ${thaiMonthYear(e.settledAt)})`
        : e.retreatedAt
          ? ` (ถอยกลับ ${thaiMonthYear(e.retreatedAt)})`
          : "";
    const contacts = e.contacts.map((c) =>
      `${c.kind}${c.body === "ลัคนา" ? "ลัคนาเดิม" : `${c.body}เดิม`}`,
    );
    const facts = [
      `${e.planet}จรเข้าราศี${e.sign}${wiggle} = ${houseLabel(e.natalHouse)} ของพื้นดวง`,
      ...contacts,
      e.transitTaksa ? `ทักษาจรปีนั้น: ${e.planet}เป็น${e.transitTaksa}` : null,
      e.score >= bigFrom ? "จุดเปลี่ยนใหญ่" : null,
    ].filter(Boolean);
    const outside = e.at.getUTCFullYear() < 1941 || e.at.getUTCFullYear() > 2040;
    lines.push(
      `- ${thaiMonthYear(e.at)} · อายุ ${e.age} · ${facts.join(" · ")}` +
        (outside ? " · (เดือนอาจคลาดได้ 1–2 เดือน)" : ""),
    );
  }
  return lines;
}
