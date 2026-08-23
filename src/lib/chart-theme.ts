/** Planet symbols/colors for chart UI (client-safe). */
export const PLANET_THEME: Record<
  string,
  { symbol: string; color: string; glow: string }
> = {
  อาทิตย์: { symbol: "☉", color: "#f5a623", glow: "rgba(245,166,35,0.35)" },
  จันทร์: { symbol: "☽", color: "#e8eef8", glow: "rgba(232,238,248,0.3)" },
  อังคาร: { symbol: "♂", color: "#e85d4a", glow: "rgba(232,93,74,0.3)" },
  พุธ: { symbol: "☿", color: "#7ec8a8", glow: "rgba(126,200,168,0.3)" },
  พฤหัสบดี: { symbol: "♃", color: "#d4a84b", glow: "rgba(212,168,75,0.35)" },
  ศุกร์: { symbol: "♀", color: "#e8a0c8", glow: "rgba(232,160,200,0.3)" },
  เสาร์: { symbol: "♄", color: "#8b9dc3", glow: "rgba(139,157,195,0.3)" },
  ราหู: { symbol: "☊", color: "#9b7ed9", glow: "rgba(155,126,217,0.35)" },
  เกตุ: { symbol: "☋", color: "#b8a088", glow: "rgba(184,160,136,0.3)" },
  มฤตยู: { symbol: "♅", color: "#5eb8d4", glow: "rgba(94,184,212,0.3)" },
};

/** Canonical planet order — matches Horasard Template.ai (๑–๙ then ๐). */
export const PLANET_ORDER = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
  "ราหู",
  "เกตุ",
  "มฤตยู",
] as const;

/** Thai-numeral glyphs used on the rasi wheel and legend pills. */
export const PLANET_THAI_NUMERAL: Record<string, string> = {
  อาทิตย์: "๑",
  จันทร์: "๒",
  อังคาร: "๓",
  พุธ: "๔",
  พฤหัสบดี: "๕",
  ศุกร์: "๖",
  เสาร์: "๗",
  ราหู: "๘",
  เกตุ: "๙",
  มฤตยู: "๐",
};

export const LAGNA_MARK = "ล";

const THAI_DIGITS = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"] as const;

export function toThaiNumeral(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => THAI_DIGITS[Number(digit)] ?? digit);
}

export const SIGN_THEME: Record<string, { hue: string; bg: string }> = {
  เมษ: { hue: "#e85d4a", bg: "rgba(232,93,74,0.15)" },
  พฤษภ: { hue: "#7ec87a", bg: "rgba(126,200,122,0.15)" },
  มิถุน: { hue: "#f5d76e", bg: "rgba(245,215,110,0.15)" },
  กรกฎ: { hue: "#e8eef8", bg: "rgba(232,238,248,0.12)" },
  สิงห์: { hue: "#f5a623", bg: "rgba(245,166,35,0.15)" },
  กันย์: { hue: "#a8c878", bg: "rgba(168,200,120,0.15)" },
  ตุลย์: { hue: "#e8a0c8", bg: "rgba(232,160,200,0.15)" },
  พิจิก: { hue: "#9b4a6a", bg: "rgba(155,74,106,0.15)" },
  ธนู: { hue: "#9b7ed9", bg: "rgba(155,126,217,0.15)" },
  มกร: { hue: "#6a5a4a", bg: "rgba(106,90,74,0.2)" },
  กุมภ: { hue: "#5eb8d4", bg: "rgba(94,184,212,0.15)" },
  มีน: { hue: "#7a9eb8", bg: "rgba(122,158,184,0.15)" },
};

export const SIGNS = [
  "เมษ",
  "พฤษภ",
  "มิถุน",
  "กรกฎ",
  "สิงห์",
  "กันย์",
  "ตุลย์",
  "พิจิก",
  "ธนู",
  "มกร",
  "กุมภ",
  "มีน",
] as const;

/**
 * Bhava (house) names for the inner ring of the "ราศีจักร" chart.
 *
 * Contract:
 * - House 1 = "ตนุ"
 * - Order goes counterclockwise to match how `houseFromLagna()` numbers 1..12
 */
export const HOUSE_NAMES = [
  "ตนุ",
  "กดุมภะ",
  "สหัชชะ",
  "พันธุ",
  "ปุตตะ",
  "อริ",
  "ปัตนิ",
  "มรณะ",
  "ศุภะ",
  "กัมมะ",
  "ลาภะ",
  "วินาศ",
] as const;

/** Plain-Thai meanings for bhava labels printed on the inner chart ring. */
export const HOUSE_MEANING: Record<(typeof HOUSE_NAMES)[number], string> = {
  ตนุ: "ตัวตน บุคลิก และสุขภาพโดยรวม",
  กดุมภะ: "การเงิน ทรัพย์สิน และคำพูด",
  สหัชชะ: "พี่น้อง การสื่อสาร และความกล้าลงมือ",
  พันธุ: "บ้าน ครอบครัว ที่อยู่อาศัย และความมั่นคง",
  ปุตตะ: "บุตร ความรักแบบสร้างสรรค์ การเรียนรู้ และผลงาน",
  อริ: "งานประจำ อุปสรรค หนี้ และสุขภาพที่ต้องดูแล",
  ปัตนิ: "คู่ครอง หุ้นส่วน และความสัมพันธ์แบบตัวต่อตัว",
  มรณะ: "การเปลี่ยนผ่าน วิกฤต มรดก และเรื่องที่ซ่อนอยู่",
  ศุภะ: "โชค การศึกษา ความเชื่อ การเดินทางไกล และผู้ใหญ่",
  กัมมะ: "อาชีพ หน้าที่ ชื่อเสียง และความรับผิดชอบ",
  ลาภะ: "รายได้ ผลสำเร็จ เพื่อน และเครือข่าย",
  วินาศ: "รายจ่าย การพักฟื้น ต่างแดน และเรื่องเบื้องหลัง",
};

export function getHouseMeaning(houseName: string): string {
  return (
    HOUSE_MEANING[houseName as (typeof HOUSE_NAMES)[number]] ??
    "ภพหรือเรือนหนึ่งในดวงชะตา"
  );
}

/** Display labels for the outer rasi ring (template uses กุมภ์). */
export const SIGN_LABEL: Record<(typeof SIGNS)[number], string> = {
  เมษ: "เมษ",
  พฤษภ: "พฤษภ",
  มิถุน: "มิถุน",
  กรกฎ: "กรกฎ",
  สิงห์: "สิงห์",
  กันย์: "กันย์",
  ตุลย์: "ตุลย์",
  พิจิก: "พิจิก",
  ธนู: "ธนู",
  มกร: "มกร",
  กุมภ: "กุมภ์",
  มีน: "มีน",
};

export function signLabel(sign: string): string {
  const normalized = normalizeSignName(sign);
  return SIGN_LABEL[normalized as (typeof SIGNS)[number]] ?? normalized;
}

/** One-line plain-Thai meaning per planet — for tap-to-learn on the wheel. */
export const PLANET_MEANING: Record<string, string> = {
  อาทิตย์: "อำนาจ เกียรติยศ ความเป็นผู้นำ ตัวตน",
  จันทร์: "จิตใจ อารมณ์ เสน่ห์ ความนิยมจากผู้คน",
  อังคาร: "พลัง ความกล้า ความขยัน การแข่งขัน",
  พุธ: "การสื่อสาร ไหวพริบ การค้า การเรียนรู้",
  พฤหัสบดี: "ปัญญา คุณธรรม ผู้ใหญ่อุปถัมภ์ โชค",
  ศุกร์: "ความรัก ศิลปะ ความงาม ทรัพย์สิน",
  เสาร์: "วินัย ความอดทน งานหนัก ที่ดิน",
  ราหู: "ความลุ่มหลง ลาภลอย สิ่งต่างแดน",
  เกตุ: "สิ่งเร้นลับ กรรมเก่า สัญชาตญาณ",
  มฤตยู: "การเปลี่ยนแปลงฉับพลัน เทคโนโลยี อิสระ",
};

export function getPlanetMeaning(planet: string): string {
  return PLANET_MEANING[planet] ?? "ดาวในดวงชะตา";
}

export function getPlanetTheme(planet: string) {
  const theme = PLANET_THEME[planet] ?? {
    symbol: "✦",
    color: "#d4a84b",
    glow: "rgba(212,168,75,0.25)",
  };
  return {
    ...theme,
    numeral: PLANET_THAI_NUMERAL[planet] ?? theme.symbol,
  };
}

export function getSignTheme(sign: string) {
  return SIGN_THEME[sign] ?? { hue: "#d4a84b", bg: "rgba(212,168,75,0.12)" };
}

/**
 * myhora rows store signs as "07 : พจ" — a 0-based sign index plus an
 * abbreviation. Users (and the wheel's name lookup) need the full name;
 * the numeric index is authoritative, the abbreviation is just a hint.
 * Full names pass through untouched.
 */
export function normalizeSignName(raw: string): string {
  if ((SIGNS as readonly string[]).includes(raw)) return raw;
  const m = /^(\d{1,2})\s*:/.exec(raw.trim());
  if (m) {
    const idx = Number(m[1]);
    if (idx >= 0 && idx < 12) return SIGNS[idx];
  }
  return raw;
}

export function signIndex(sign: string): number {
  const i = SIGNS.indexOf(normalizeSignName(sign) as (typeof SIGNS)[number]);
  return i >= 0 ? i : 0;
}

export function houseFromLagna(lagnaSign: string, planetSign: string): number {
  const lagnaIdx = signIndex(lagnaSign);
  const planetIdx = signIndex(planetSign);
  return ((planetIdx - lagnaIdx + 12) % 12) + 1;
}

/** Map a sign position to its corresponding bhava name (ตามลัคนา). */
export function bhavaNameFromLagna(lagnaSign: string, planetSign: string): string {
  const house = houseFromLagna(lagnaSign, planetSign);
  return HOUSE_NAMES[house - 1] ?? "—";
}
