import type { MyhoraNatalPlanet } from "@/types/myhora";
import { HOUSE_NAMES, normalizeSignName, SIGNS } from "@/lib/chart-theme";
import { dignityLabel } from "@/lib/thai-dignity";

/**
 * Fill the columns of a สมผุส row that the source left empty.
 *
 * myhora's ดวงจร table carries a planet's sign and degree but none of the
 * detail row the natal table has — ตรียางค์, นวางศ์, ฤกษ์, บาท, เจ้าเรือน,
 * มาตรฐาน came back blank, in the chart table and in the prompt alike. Every
 * one of them follows from the sign and degree; the formats below are the
 * ones myhora prints in its natal table, checked row by row against it
 * (e.g. อาทิตย์ พิจิก 1°08' → ฤกษ์:นาที "15 : 50", วิสาขะ, จตุตถ, เพชฌฆาต,
 * นวางศ์ "1 : 2 : กฎ", ตรียางค์ "1 : 3 : พจ").
 */

const ABBR = ["มษ", "พภ", "มถ", "กฎ", "สห", "กน", "ตล", "พจ", "ธน", "มก", "กภ", "มน"];

/**
 * Sign lords by planet number. For กุมภ์ myhora's ตรียางค์ names เสาร์ (7)
 * while its นวางศ์ and เจ้าเรือน columns name ราหู (๘) — both as printed.
 */
const TRIYANG_LORD = [3, 6, 4, 2, 1, 4, 6, 3, 5, 7, 7, 5];
const LORD_NUMBER = [3, 6, 4, 2, 1, 4, 6, 3, 5, 7, 8, 5];
const LORD_NAME: Record<number, string> = {
  1: "อาทิตย์", 2: "จันทร์", 3: "อังคาร", 4: "พุธ", 5: "พฤหัสบดี", 6: "ศุกร์", 7: "เสาร์", 8: "ราหู",
};

const NAKSHATRA = [
  // Spelled as myhora prints them (checked against 231 of its rows).
  "อัศวินี", "ภรณี", "กฤติกา", "โรหิณี", "มฤคศิระ", "อารทรา", "ปุนัพสุ", "ปุษยะ", "อาศเลษะ",
  "มาฆะ", "บุรพผลคุนี", "อุตรผลคุนี", "หัสตะ", "จิตรา", "สวาตี", "วิสาขะ", "อนุราธะ", "เชษฐา",
  "มูละ", "ปุรพษาฒ", "อุตราษาฒ", "ศรวณะ", "ธนิษฐา", "ศตภิษัช", "บุรพภัทร", "อุตตรภัทร", "เรวดี",
];
/** ฤกษ์ 9 หมู่, repeating every nine นักษัตร. */
const RERK_BIG = ["ทลิทโท", "มหัทธโน", "โจโร", "ภูมิปาโล", "เทศาตรี", "เทวี", "เพชฌฆาต", "ราชา", "สมโณ"];
const BAHT = ["ปฐม", "ทุติย", "ตติย", "จตุตถ"];

function signIndex(raw: string): number {
  const sign = normalizeSignName(raw.replace(/^\d+\s*:\s*/, ""));
  const direct = (SIGNS as readonly string[]).indexOf(sign);
  if (direct >= 0) return direct;
  return ABBR.indexOf(raw.replace(/^\d+\s*:\s*/, "").trim());
}

function planetName(raw: string): string {
  return raw.replace(/^[๐-๙0-9.\s]+/, "").trim();
}

/** Sidereal longitude of a row, or null when its sign or degree is unreadable. */
export function rowLongitude(row: Pick<MyhoraNatalPlanet, "zodiac" | "degree" | "minute">): number | null {
  const s = signIndex(row.zodiac ?? "");
  const deg = Number.parseInt(row.degree ?? "", 10);
  const min = Number.parseInt(row.minute ?? "", 10);
  if (s < 0 || !Number.isFinite(deg)) return null;
  return s * 30 + deg + (Number.isFinite(min) ? min / 60 : 0);
}

function part(n: number, sign: number, lords: readonly number[]): string {
  return `${n} : ${lords[sign]} : ${ABBR[sign]}`;
}

/**
 * The derived columns for a planet at `longitude`, with houses counted from
 * `lagna` (the natal lagna for a ดวงจร row).
 */
export function deriveSamrapColumns(
  planet: string,
  longitude: number,
  lagna: string | null,
): Partial<MyhoraNatalPlanet> {
  const lon = ((longitude % 360) + 360) % 360;
  const sign = Math.floor(lon / 30);
  const deg = lon - sign * 30;

  const dNo = Math.floor(deg / 10);
  const drekkana = (sign + 4 * dNo) % 12;
  const nNo = Math.floor(deg / (10 / 3));
  const navStart = [0, 9, 6, 3][sign % 4]!;
  const navamsa = (navStart + nNo) % 12;

  // Whole arc-minutes: 84°00′ as a float floored to the previous นักษัตร.
  // A นักษัตร is 13°20′ = 800′.
  const arcMin = Math.round(lon * 60) % 21_600;
  const naksNo = Math.floor(arcMin / 800);
  const within = arcMin % 800;

  const name = planetName(planet);
  const lagnaIdx = lagna ? (SIGNS as readonly string[]).indexOf(normalizeSignName(lagna)) : -1;
  const house = lagnaIdx >= 0 ? ((sign - lagnaIdx + 12) % 12) + 1 : null;

  const owned: string[] = [];
  if (lagnaIdx >= 0) {
    LORD_NUMBER.forEach((lordNo, s) => {
      if (LORD_NAME[lordNo] === name) owned.push(HOUSE_NAMES[(s - lagnaIdx + 12) % 12]!);
    });
  }

  const standard: string[] = [];
  const dignity = dignityLabel(name, SIGNS[sign]!);
  if (dignity === "อุจจ์") standard.push("มหาอุจจ์");
  // กุมภ์ is ราหู's house in Thai reckoning; เสาร์ there is its original
  // (มูล) เกษตร, as myhora prints it.
  else if (dignity === "เกษตร" && name === "เสาร์" && sign === 10) standard.push("มูลเกษตร");
  else if (dignity === "นิจ" || dignity === "เกษตร" || dignity === "ประ") standard.push(dignity);
  // myhora marks เรือนเกณฑ์ on planets, not on the lagna itself, เกตุ or มฤตยู.
  if (house && [1, 4, 7, 10].includes(house) && !/ลัคนา|เกตุ|มฤตยู/.test(planet)) standard.push("เรือนเกณฑ์");

  return {
    triyang: part(dNo + 1, drekkana, TRIYANG_LORD),
    nawamang: part(nNo + 1, navamsa, LORD_NUMBER),
    // myhora numbers อัศวินี 27, not 00.
    rerk: `${String(naksNo === 0 ? 27 : naksNo).padStart(2, "0")} : ${String(Math.floor((within * 60) / 800)).padStart(2, "0")}`,
    rerkName: NAKSHATRA[naksNo] ?? "",
    baht: BAHT[Math.min(3, Math.floor(within / 200))]!,
    rerkBig: RERK_BIG[naksNo % 9]!,
    rerkOwner: owned.join(" "),
    rerkStandard: standard.join(" "),
  };
}

/** Rows with their empty columns filled; columns the source supplied are kept. */
export function fillSamrapRows<T extends MyhoraNatalPlanet>(
  rows: T[],
  lagna: string | null,
): T[] {
  return rows.map((row) => {
    const lon = rowLongitude(row);
    if (lon === null) return row;
    const derived = deriveSamrapColumns(row.planet, lon, lagna);
    const out = { ...row } as T;
    for (const [key, value] of Object.entries(derived) as [keyof MyhoraNatalPlanet, string][]) {
      if (!out[key] && value) (out as unknown as Record<string, string>)[key] = value;
    }
    return out;
  });
}
