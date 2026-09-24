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

const LORDS: Record<string, string> = {
  เมษ: "อังคาร",
  พฤษภ: "ศุกร์",
  มิถุน: "พุธ",
  กรกฎ: "จันทร์",
  สิงห: "อาทิตย์",
  กันย: "พุธ",
  ตุลย: "ศุกร์",
  พิจิก: "อังคาร",
  ธนู: "พฤหัสบดี",
  มกร: "เสาร์",
  กุมภ: "เสาร์",
  มีน: "พฤหัสบดี",
};

/** เจ้าเรือน of a sign (Thai rulership), or null for an unknown sign. */
export function lordOfSign(sign: string | null | undefined): string | null {
  return LORDS[bareSign(sign)] ?? null;
}

const DIGNITY: Record<string, { own: string[]; exalt: string[]; fall: string[] }> = {
  อาทิตย์: { own: ["สิงห"], exalt: ["เมษ"], fall: ["ตุลย"] },
  จันทร์: { own: ["กรกฎ"], exalt: ["พฤษภ"], fall: ["พิจิก"] },
  อังคาร: { own: ["เมษ", "พิจิก"], exalt: ["มกร"], fall: ["กรกฎ"] },
  พุธ: { own: ["มิถุน", "กันย"], exalt: ["กันย"], fall: ["มีน"] },
  พฤหัสบดี: { own: ["ธนู", "มีน"], exalt: ["กรกฎ"], fall: ["มกร"] },
  ศุกร์: { own: ["พฤษภ", "ตุลย"], exalt: ["มีน"], fall: ["กันย"] },
  เสาร์: { own: ["มกร", "กุมภ"], exalt: ["ตุลย"], fall: ["เมษ"] },
};

const SIGN_ORDER = [
  "เมษ", "พฤษภ", "มิถุน", "กรกฎ", "สิงห", "กันย",
  "ตุลย", "พิจิก", "ธนู", "มกร", "กุมภ", "มีน",
];

function opposite(sign: string): string {
  const idx = SIGN_ORDER.indexOf(sign);
  return idx < 0 ? "" : SIGN_ORDER[(idx + 6) % 12]!;
}

export type DignityLabel = "อุจจ์" | "นิจ" | "เกษตร" | "ประ" | "ปกติ" | "—";

/**
 * มาตรฐานดาว. "ประ" is the sign opposite a planet's own sign (as the ตำรา in
 * the knowledge base defines it); it was missing entirely. "นิจ" is spelled
 * the way the ตำรา and the team write it.
 */
export function dignityLabel(planet: string, sign: string): DignityLabel {
  const name = planet === "พฤหัส" ? "พฤหัสบดี" : planet;
  const d = DIGNITY[name];
  if (!d) return "—";
  const s = bareSign(sign);
  if (d.exalt.includes(s)) return "อุจจ์";
  if (d.fall.includes(s)) return "นิจ";
  if (d.own.includes(s)) return "เกษตร";
  if (d.own.some((own) => opposite(own) === s)) return "ประ";
  return "ปกติ";
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
