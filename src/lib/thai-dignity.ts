/**
 * Thai rulership, dignity and element tables — one copy.
 *
 * These used to live in three files. The copies drifted: one spelled Saturn's
 * second sign "กุมภ์" while the engine emits "กุมภ", so Saturn in Aquarius was
 * never recognised as เกษตร in the chart table the model reads.
 */

/** Signs are compared without the trailing ์ the engine does not write. */
export function bareSign(sign: string | null | undefined): string {
  return (sign ?? "").replace(/^ราศี/, "").replace(/์$/u, "").trim();
}

import {
  STANDARD_SIGNS,
  activePlanetStandards,
  hasStandards,
  standardsOf,
  type StandardSign,
} from "@/lib/planet-standards";

const asSign = (sign: string | null | undefined): StandardSign | null => {
  const s = bareSign(sign);
  return (STANDARD_SIGNS as readonly string[]).includes(s) ? (s as StandardSign) : null;
};

/**
 * เจ้าเรือน of a sign, from the team's ตารางมาตรฐานดาว (Admin → มาตรฐานดาว),
 * or null for an unknown sign. By default กุมภ์ is ราหู's, as HoraSard sets it.
 */
export function lordOfSign(sign: string | null | undefined): string | null {
  const s = asSign(sign);
  return s ? activePlanetStandards().lords[s] : null;
}

/** The older lord a sign also keeps (by default กุมภ์ → เสาร์). */
export function originalLordOfSign(sign: string | null | undefined): string | null {
  const s = asSign(sign);
  return s ? (activePlanetStandards().originalLords[s] ?? null) : null;
}

/** "ราหู (เจ้าเรือนเดิม เสาร์)" for กุมภ์, the plain lord elsewhere. */
export function lordLabel(sign: string | null | undefined): string | null {
  const lord = lordOfSign(sign);
  const original = originalLordOfSign(sign);
  return lord && original ? `${lord} (เจ้าเรือนเดิม ${original})` : lord;
}

export type DignityLabel = "อุจจ์" | "นิจ" | "เกษตร" | "ประ" | "ปกติ" | "—";

/**
 * มาตรฐานดาว from the team's table: อุจจ์, then นิจ, เกษตร, ประ, else ปกติ;
 * "—" for a planet the table says nothing about (เกตุ, มฤตยู by default).
 * "นิจ" is spelled the way the ตำรา and the team write it.
 */
export function dignityLabel(planet: string, sign: string): DignityLabel {
  const name = planet === "พฤหัส" ? "พฤหัสบดี" : planet;
  if (!hasStandards(name)) return "—";
  const found = standardsOf(name, bareSign(sign));
  for (const kind of ["อุจจ์", "นิจ", "เกษตร", "ประ"] as const) if (found.includes(kind)) return kind;
  return "ปกติ";
}

/** มหาจักร, ราชาโชค, อุจจาวิลาศ … (every column past the basic four) the planet holds in `sign`, if the team filled them in. */
export function extraStandardLabels(planet: string, sign: string): string[] {
  const name = planet === "พฤหัส" ? "พฤหัสบดี" : planet;
  return standardsOf(name, bareSign(sign)).filter((k) => !["อุจจ์", "นิจ", "เกษตร", "ประ"].includes(k));
}

/**
 * The team's element table — "ห้ามตีความระบบธาตุอื่นนอกเหนือจากนี้".
 * เกตุ and มฤตยู are deliberately absent: the table gives them none.
 */
export const PLANET_ELEMENT: Record<string, "ไฟ" | "ดิน" | "ลม" | "น้ำ"> = {
  อาทิตย์: "ไฟ",
  เสาร์: "ไฟ",
  จันทร์: "ดิน",
  พฤหัสบดี: "ดิน",
  อังคาร: "ลม",
  ราหู: "ลม",
  พุธ: "น้ำ",
  ศุกร์: "น้ำ",
};

export function elementOf(planet: string): string | null {
  return PLANET_ELEMENT[planet === "พฤหัส" ? "พฤหัสบดี" : planet] ?? null;
}
