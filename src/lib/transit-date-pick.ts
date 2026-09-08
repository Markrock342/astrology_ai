import { BUDDHIST_YEAR_OFFSET } from "@/lib/date";
import { normalizeThaiDigits } from "@/lib/wheel-input";
import {
  addCalendarDays,
  addCalendarMonths,
  bangkokCivilDate,
  bangkokDateKey,
} from "@/lib/reading-intent";

export type TransitDatePreset = "today" | "tomorrow" | "plus1m" | "plus3m";

export const TRANSIT_DATE_PRESETS: Array<{
  kind: TransitDatePreset;
  label: string;
}> = [
  { kind: "today", label: "วันนี้" },
  { kind: "tomorrow", label: "พรุ่งนี้" },
  { kind: "plus1m", label: "อีก 1 เดือน" },
  { kind: "plus3m", label: "อีก 3 เดือน" },
];

const THAI_MONTHS: Array<{ keys: string[]; month: number }> = [
  { keys: ["ม.ค.", "มกราคม", "มกรา"], month: 1 },
  { keys: ["ก.พ.", "กุมภาพันธ์", "กุมภา"], month: 2 },
  { keys: ["มี.ค.", "มีนาคม", "มีนา"], month: 3 },
  { keys: ["เม.ย.", "เมษายน", "เมษา"], month: 4 },
  { keys: ["พ.ค.", "พฤษภาคม", "พฤษภา"], month: 5 },
  { keys: ["มิ.ย.", "มิถุนายน", "มิถุนา"], month: 6 },
  { keys: ["ก.ค.", "กรกฎาคม", "กรกฎา"], month: 7 },
  { keys: ["ส.ค.", "สิงหาคม", "สิงหา"], month: 8 },
  { keys: ["ก.ย.", "กันยายน", "กันยา"], month: 9 },
  { keys: ["ต.ค.", "ตุลาคม", "ตุลา"], month: 10 },
  { keys: ["พ.ย.", "พฤศจิกายน", "พฤศจิกา"], month: 11 },
  { keys: ["ธ.ค.", "ธันวาคม", "ธันวา"], month: 12 },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toCeYear(year: number): number {
  return year > 2400 ? year - BUDDHIST_YEAR_OFFSET : year;
}

export function formatTransitDateKey(
  year: number,
  month: number,
  day: number,
): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(day, 1), last);
  return `${year}-${pad2(month)}-${pad2(safeDay)}`;
}

export function parseTransitDateKey(
  value: string,
): { year: number; month: number; day: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!hit) return null;
  const year = Number(hit[1]);
  const month = Number(hit[2]);
  const day = Number(hit[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function transitDateKeyFromPreset(
  kind: TransitDatePreset,
  now = new Date(),
): string {
  if (kind === "today") return bangkokDateKey(now);
  if (kind === "tomorrow") return bangkokDateKey(addCalendarDays(now, 1));
  if (kind === "plus1m") return bangkokDateKey(addCalendarMonths(now, 1));
  return bangkokDateKey(addCalendarMonths(now, 3));
}

/**
 * Accept the ways Thai users actually type a วันจร: 8/9/2569, 15 ต.ค. 2569,
 * or a YYYY-MM-DD key. Thai numerals are normalized first.
 */
export function parseTypedTransitDate(
  raw: string,
  now = new Date(),
): string | null {
  const typed = normalizeThaiDigits(raw).trim();
  if (!typed) return null;

  const iso = parseTransitDateKey(typed);
  if (iso) return formatTransitDateKey(iso.year, iso.month, iso.day);

  const slash = typed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const rawYear = slash[3]!;
    const year = toCeYear(
      Number(rawYear.length === 2 ? `25${rawYear}` : rawYear),
    );
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatTransitDateKey(year, month, day);
    }
  }

  const [cy] = bangkokDateKey(now).split("-").map(Number);
  for (const row of THAI_MONTHS) {
    for (const key of row.keys) {
      const re = new RegExp(
        `^(\\d{1,2})\\s*${key.replace(/\./g, "\\.")}\\s*(\\d{4})?$`,
        "i",
      );
      const hit = typed.match(re);
      if (!hit) continue;
      const day = Number(hit[1]);
      const year = hit[2] ? toCeYear(Number(hit[2])) : cy;
      if (day >= 1 && day <= 31) {
        return formatTransitDateKey(year, row.month, day);
      }
    }
  }

  return null;
}

export function transitDateLabelFromKey(value: string): string | null {
  const parts = parseTransitDateKey(value);
  if (!parts) return null;
  return bangkokCivilDate(parts.year, parts.month, parts.day).toLocaleDateString(
    "th-TH",
    { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" },
  );
}
