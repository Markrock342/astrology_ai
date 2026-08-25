import type { BirthInputSnapshot, TaksaSlot } from "@/types/chart";
import type { MyhoraTaksaCell } from "@/types/myhora";

export const TAKSA_NAMES = [
  "บริวาร", "อายุ", "เดช", "ศรี", "มูละ", "อุตสาหะ", "มนตรี", "กาลกิณี",
] as const;

export type TaksaName = (typeof TAKSA_NAMES)[number];

/** Method-1 daily transit labels — same 8 roles with 「จร」suffix. */
export const TAKSA_TRANSIT_NAMES = [
  "บริวารจร",
  "อายุจร",
  "เดชจร",
  "ศรีจร",
  "มูละจร",
  "อุตสาหะจร",
  "มนตรีจร",
  "กาลกิณีจร",
] as const;

export type TaksaTransitName = (typeof TAKSA_TRANSIT_NAMES)[number];
export type TaksaMode = "natal" | "transit";
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

/** Build the 8 slots for a weekday key (natal names or transit 「…จร」 names). */
export function slotsForWeekday(
  day: TaksaBirthDay,
  mode: TaksaMode = "natal",
): TaksaSlot[] {
  return slotsFromStartPlanet(DAY_START_PLANET[day], mode);
}

/** Complete seven-day reference table; Wednesday night uses Rahu as its lord. */
export const TAKSA_WEEKDAY_TABLE = {
  อาทิตย์: slotsForWeekday("อาทิตย์"),
  จันทร์: slotsForWeekday("จันทร์"),
  อังคาร: slotsForWeekday("อังคาร"),
  พุธกลางวัน: slotsForWeekday("พุธกลางวัน"),
  พุธกลางคืน: slotsForWeekday("พุธกลางคืน"),
  พฤหัสบดี: slotsForWeekday("พฤหัสบดี"),
  ศุกร์: slotsForWeekday("ศุกร์"),
  เสาร์: slotsForWeekday("เสาร์"),
} satisfies Record<TaksaBirthDay, TaksaSlot[]>;

/** Method-1 daily transit tables (same geometry as natal, labels with จร). */
export const TAKSA_TRANSIT_WEEKDAY_TABLE = {
  อาทิตย์: slotsForWeekday("อาทิตย์", "transit"),
  จันทร์: slotsForWeekday("จันทร์", "transit"),
  อังคาร: slotsForWeekday("อังคาร", "transit"),
  พุธกลางวัน: slotsForWeekday("พุธกลางวัน", "transit"),
  พุธกลางคืน: slotsForWeekday("พุธกลางคืน", "transit"),
  พฤหัสบดี: slotsForWeekday("พฤหัสบดี", "transit"),
  ศุกร์: slotsForWeekday("ศุกร์", "transit"),
  เสาร์: slotsForWeekday("เสาร์", "transit"),
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

export function formatTaksaDayHeading(
  day: TaksaBirthDay,
  mode: TaksaMode = "natal",
): string {
  const natal: Record<TaksaBirthDay, string> = {
    อาทิตย์: "วันอาทิตย์",
    จันทร์: "วันจันทร์",
    อังคาร: "วันอังคาร",
    พุธกลางวัน: "วันพุธ",
    พุธกลางคืน: "วันพุธกลางคืน",
    พฤหัสบดี: "วันพฤหัสบดี",
    ศุกร์: "วันศุกร์",
    เสาร์: "วันเสาร์",
  };
  const transit: Record<TaksaBirthDay, string> = {
    อาทิตย์: "วันอาทิตย์จร",
    จันทร์: "วันจันทร์จร",
    อังคาร: "วันอังคารจร",
    พุธกลางวัน: "วันพุธจร",
    พุธกลางคืน: "วันพุธกลางคืนจร",
    พฤหัสบดี: "วันพฤหัสบดีจร",
    ศุกร์: "วันศุกร์จร",
    เสาร์: "วันเสาร์จร",
  };
  return mode === "transit" ? transit[day] : natal[day];
}

export function computeTaksaFromBirth(input: BirthInputSnapshot): TaksaSlot[] {
  return slotsForWeekday(resolveTaksaBirthDay(input), "natal").map((slot) => ({
    ...slot,
  }));
}

/**
 * Method 1 (Practical): the transit weekday itself is บริวารจร.
 * Uses the same 06:00 / Wednesday-night day boundary as natal.
 */
export function computeTransitTaksaMethod1(
  input: BirthInputSnapshot,
): TaksaSlot[] {
  return slotsForWeekday(resolveTaksaBirthDay(input), "transit").map((slot) => ({
    ...slot,
  }));
}

/** Flatten slots to `{ planetNum: label }` for grid / fixture asserts. */
export function taksaLabelByPlanetNum(
  slots: TaksaSlot[],
): Record<number, string> {
  return Object.fromEntries(slots.map((slot) => [slot.planetNum, slot.taksa]));
}

export type CombinedTaksaCell = {
  planetNum: number;
  natalLabel: string | null;
  transitLabel: string | null;
  isCenter: boolean;
  highlightTransit: boolean;
};

export type AgeTransitTaksa = {
  slots: TaksaSlot[];
  yangKao: number;
  centerIsBorivanTransit: boolean;
};

function slotsFromStartPlanet(
  startPlanet: number,
  mode: TaksaMode,
): TaksaSlot[] {
  const names = mode === "transit" ? TAKSA_TRANSIT_NAMES : TAKSA_NAMES;
  const start = TAKSA_PLANET_CYCLE.indexOf(
    startPlanet as (typeof TAKSA_PLANET_CYCLE)[number],
  );
  const origin = start >= 0 ? start : 0;
  return names.map((taksa, index) => {
    const planetNum =
      TAKSA_PLANET_CYCLE[(origin + index) % TAKSA_PLANET_CYCLE.length] ?? 1;
    return {
      taksa,
      planet: TAKSA_PLANET_NAMES[planetNum] ?? "อาทิตย์",
      planetNum,
      index,
    };
  });
}

/** อายุย่างเข้า = completed solar years + 1 (never below 1). */
export function yangKaoAge(birth: BirthInputSnapshot, asOf: Date): number {
  const asY = asOf.getFullYear();
  const asM = asOf.getMonth() + 1;
  const asD = asOf.getDate();
  let completed = asY - birth.year;
  if (asM < birth.month || (asM === birth.month && asD < birth.day)) {
    completed -= 1;
  }
  return Math.max(1, completed + 1);
}

/**
 * ทักษาปีจร: บริวารจร walks the natal circuit with อายุย่างเข้า.
 * `countFromCenter` adds Ketu as year 9 (นับอายุจรตากลาง).
 */
export function computeTransitTaksaByAge(
  input: BirthInputSnapshot,
  asOf: Date,
  countFromCenter = true,
): AgeTransitTaksa {
  const natalBorivan = computeTaksaFromBirth(input)[0]?.planetNum ?? 1;
  const yangKao = yangKaoAge(input, asOf);
  const startIdx = TAKSA_PLANET_CYCLE.indexOf(
    natalBorivan as (typeof TAKSA_PLANET_CYCLE)[number],
  );
  const origin = startIdx >= 0 ? startIdx : 0;

  if (!countFromCenter) {
    const steps = (yangKao - 1) % 8;
    const transitBorivan =
      TAKSA_PLANET_CYCLE[(origin + steps) % TAKSA_PLANET_CYCLE.length] ??
      natalBorivan;
    return {
      slots: slotsFromStartPlanet(transitBorivan, "transit"),
      yangKao,
      centerIsBorivanTransit: false,
    };
  }

  const ninePath = [
    ...Array.from(
      { length: 8 },
      (_, index) =>
        TAKSA_PLANET_CYCLE[(origin + index) % TAKSA_PLANET_CYCLE.length] ??
        natalBorivan,
    ),
    9,
  ];
  const landing = ninePath[(yangKao - 1) % 9] ?? 9;
  if (landing === 9) {
    return {
      slots: slotsFromStartPlanet(natalBorivan, "transit").map((slot) =>
        slot.taksa === "บริวารจร" ? { ...slot, taksa: "" } : slot,
      ),
      yangKao,
      centerIsBorivanTransit: true,
    };
  }
  return {
    slots: slotsFromStartPlanet(landing, "transit"),
    yangKao,
    centerIsBorivanTransit: false,
  };
}

export function buildCombinedTaksaGrid(
  natalSlots: TaksaSlot[],
  transitSlots: TaksaSlot[],
  centerIsBorivanTransit = false,
): CombinedTaksaCell[] {
  return TAKSA_CELL_PLANETS.flat().map((planetNum) => {
    const isCenter = planetNum === 9;
    const natal = natalSlots.find((slot) => slot.planetNum === planetNum);
    const transit = transitSlots.find((slot) => slot.planetNum === planetNum);
    const transitLabel = isCenter
      ? centerIsBorivanTransit
        ? "บริวารจร"
        : null
      : transit?.taksa || null;
    return {
      planetNum,
      natalLabel: isCenter ? null : natal?.taksa ?? null,
      transitLabel,
      isCenter,
      highlightTransit: transitLabel === "บริวารจร",
    };
  });
}

/** Use the scraped MyHora overlay when natal + จร labels are both present. */
export function combinedGridFromScraped(
  grid: (MyhoraTaksaCell | null)[][] | null | undefined,
): CombinedTaksaCell[] | null {
  if (!grid?.length) return null;
  const byPlanet = new Map<number, MyhoraTaksaCell>();
  for (const cell of grid.flat()) {
    if (!cell?.planetNum) continue;
    byPlanet.set(cell.planetNum, cell);
  }
  if (![1, 2, 3, 4, 5, 6, 7, 8].every((num) => byPlanet.has(num))) return null;
  const hasTransit = [...byPlanet.values()].some((cell) =>
    Boolean(cell.transitLabel),
  );
  if (!hasTransit) return null;

  return TAKSA_CELL_PLANETS.flat().map((planetNum) => {
    const cell = byPlanet.get(planetNum);
    const isCenter = planetNum === 9 || Boolean(cell?.isCenter);
    const transitLabel = cell?.transitLabel || null;
    return {
      planetNum,
      natalLabel: isCenter ? null : cell?.label || null,
      transitLabel,
      isCenter,
      highlightTransit:
        Boolean(cell?.highlighted) || transitLabel === "บริวารจร",
    };
  });
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
