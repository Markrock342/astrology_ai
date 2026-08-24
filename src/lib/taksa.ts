import type { BirthInputSnapshot, TaksaSlot } from "@/types/chart";
import type { MyhoraTaksaCell } from "@/types/myhora";

export const TAKSA_NAMES = [
  "บริวาร", "อายุ", "เดช", "ศรี", "มูละ", "อุตสาหะ", "มนตรี", "กาลกิณี",
] as const;

export type TaksaName = (typeof TAKSA_NAMES)[number];
export type TaksaBirthDay =
  | "อาทิตย์" | "จันทร์" | "อังคาร" | "พุธกลางวัน"
  | "พุธกลางคืน" | "พฤหัสบดี" | "ศุกร์" | "เสาร์";

/** Physical 3×3 layout used by the Thai Taksa chart; ๙ (Ketu) is the centre. */
export const TAKSA_CELL_PLANETS = [
  [1, 2, 3],
  [6, 9, 4],
  [8, 5, 7],
] as const;

export const TAKSA_PLANET_NAMES: Record<number, string> = {
  1: "อาทิตย์", 2: "จันทร์", 3: "อังคาร", 4: "พุธ",
  5: "พฤหัสบดี", 6: "ศุกร์", 7: "เสาร์", 8: "ราหู", 9: "เกตุ",
};

// Traditional Taksa circuit. A birth-day lord starts at บริวาร, then the
// remaining seven duties follow this fixed circuit.
const TAKSA_PLANET_CYCLE = [1, 2, 3, 4, 7, 5, 8, 6] as const;
const DAY_START_PLANET: Record<TaksaBirthDay, number> = {
  อาทิตย์: 1, จันทร์: 2, อังคาร: 3, พุธกลางวัน: 4,
  พุธกลางคืน: 8, พฤหัสบดี: 5, ศุกร์: 6, เสาร์: 7,
};

function slotsForDay(day: TaksaBirthDay): TaksaSlot[] {
  const start = TAKSA_PLANET_CYCLE.indexOf(
    DAY_START_PLANET[day] as (typeof TAKSA_PLANET_CYCLE)[number],
  );
  return TAKSA_NAMES.map((taksa, index) => {
    const planetNum = TAKSA_PLANET_CYCLE[(start + index) % TAKSA_PLANET_CYCLE.length] ?? 1;
    return {
      taksa,
      planet: TAKSA_PLANET_NAMES[planetNum] ?? "อาทิตย์",
      planetNum,
      index,
    };
  });
}

/** Complete seven-day reference table; Wednesday night uses Rahu as its lord. */
export const TAKSA_WEEKDAY_TABLE = {
  อาทิตย์: slotsForDay("อาทิตย์"),
  จันทร์: slotsForDay("จันทร์"),
  อังคาร: slotsForDay("อังคาร"),
  พุธกลางวัน: slotsForDay("พุธกลางวัน"),
  พุธกลางคืน: slotsForDay("พุธกลางคืน"),
  พฤหัสบดี: slotsForDay("พฤหัสบดี"),
  ศุกร์: slotsForDay("ศุกร์"),
  เสาร์: slotsForDay("เสาร์"),
} satisfies Record<TaksaBirthDay, TaksaSlot[]>;

/**
 * Resolve the traditional birth day. The astrological day changes at 06:00;
 * Wednesday 18:00 through Thursday 05:59 is Wednesday-night (Rahu).
 */
export function resolveTaksaBirthDay(input: BirthInputSnapshot): TaksaBirthDay {
  const hour = Number.parseInt(input.time.split(":")[0] ?? "12", 10);
  const safeHour = Number.isFinite(hour) ? hour : 12;
  const civil = new Date(Date.UTC(input.year, input.month - 1, input.day));
  const civilWeekday = civil.getUTCDay();

  if (civilWeekday === 3 && safeHour >= 18) return "พุธกลางคืน";
  if (civilWeekday === 4 && safeHour < 6) return "พุธกลางคืน";

  const effective = new Date(civil);
  if (safeHour < 6) effective.setUTCDate(effective.getUTCDate() - 1);
  const labels: Record<number, TaksaBirthDay> = {
    0: "อาทิตย์", 1: "จันทร์", 2: "อังคาร", 3: "พุธกลางวัน",
    4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์",
  };
  return labels[effective.getUTCDay()] ?? "อาทิตย์";
}

export function computeTaksaFromBirth(input: BirthInputSnapshot): TaksaSlot[] {
  return TAKSA_WEEKDAY_TABLE[resolveTaksaBirthDay(input)].map((slot) => ({ ...slot }));
}

/** Prefer the exact parsed MyHora natal grid when all eight lords are present. */
export function taksaSlotsFromMyhoraGrid(
  grid: (MyhoraTaksaCell | null)[][],
): TaksaSlot[] | null {
  const byRole = new Map<string, TaksaSlot>();
  for (const cell of grid.flat()) {
    if (!cell?.label || !cell.planetNum || cell.planetNum === 9) continue;
    if (!TAKSA_NAMES.includes(cell.label as TaksaName)) continue;
    byRole.set(cell.label, {
      taksa: cell.label,
      planet: TAKSA_PLANET_NAMES[cell.planetNum] ?? String(cell.planetNum),
      planetNum: cell.planetNum,
      index: TAKSA_NAMES.indexOf(cell.label as TaksaName),
    });
  }
  if (byRole.size !== TAKSA_NAMES.length) return null;
  return TAKSA_NAMES.map((name) => byRole.get(name)!).filter(Boolean);
}

export function isCurrentTaksaSlots(slots: unknown): slots is TaksaSlot[] {
  if (!Array.isArray(slots) || slots.length !== TAKSA_NAMES.length) return false;
  return slots.every(
    (slot) => slot && typeof slot === "object" &&
      typeof (slot as TaksaSlot).planet === "string" &&
      typeof (slot as TaksaSlot).planetNum === "number" &&
      TAKSA_NAMES.includes((slot as TaksaSlot).taksa as TaksaName),
  );
}

export function resolveTaksaSlots(
  input: BirthInputSnapshot,
  stored?: TaksaSlot[] | null,
): TaksaSlot[] {
  return isCurrentTaksaSlots(stored) ? stored : computeTaksaFromBirth(input);
}
