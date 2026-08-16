import type { PlanetSignRow, TaksaSlot } from "@/types/chart";
import { normalizeSignName, SIGNS } from "@/lib/chart-theme";

/**
 * ทักษา 9 ช่อง — นับจากกลาง (ลัคนา) ตามสูตร newhora
 * Client-safe copy so the chart UI does not import the server engine.
 */
export const TAKSA_NAMES = [
  "กาลกุล",
  "ทราย",
  "อุตตร",
  "วิชาคุณ",
  "ปัญหา",
  "กาลกินี",
  "เทวี",
  "โชคลาภ",
  "ศรี",
] as const;

/** Horasard Template.ai 3×3: ๙ is center, ๑–๘ run around it. */
export const TAKSA_CELL_NUMBERS = [
  [1, 2, 3],
  [8, 9, 4],
  [7, 6, 5],
] as const;

export function computeTaksaFromLagna(lagnaSign: string): TaksaSlot[] {
  const lagnaIdx = SIGNS.indexOf(
    normalizeSignName(lagnaSign) as (typeof SIGNS)[number],
  );
  const base = lagnaIdx >= 0 ? lagnaIdx : 0;

  return TAKSA_NAMES.map((taksa, i) => {
    const signIdx = (base + i) % 12;
    return {
      taksa,
      sign: SIGNS[signIdx] ?? "เมษ",
      index: i,
    };
  });
}

/** Template cell ๙ = engine index 0 (center / lagna). Cells ๑–๘ = index 1–8. */
export function taksaIndexFromCellNumber(cell: number): number {
  return cell === 9 ? 0 : cell;
}

export function resolveTaksaSlots(
  lagna: string,
  stored?: TaksaSlot[] | null,
): TaksaSlot[] {
  if (stored && stored.length === 9) return stored;
  return computeTaksaFromLagna(lagna);
}

export function planetsInSign(
  planets: PlanetSignRow[],
  sign: string,
): PlanetSignRow[] {
  const target = normalizeSignName(sign);
  return planets.filter((row) => normalizeSignName(row.siderealSign) === target);
}
