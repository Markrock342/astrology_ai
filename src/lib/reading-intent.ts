import { DISPLAY_TIMEZONE } from "@/config/constants";
import { formatTransitDateLabel } from "@/lib/transit-label";

export type ReadingIntent = "natal" | "transit";

export type TransitWindow = {
  intent: ReadingIntent;
  start: Date;
  end: Date;
  /** Chart used for the wheel + primary [transit] block. */
  sampleAt: Date;
  /** Second chart when the question is a range (e.g. 3 months). */
  horizonAt: Date | null;
  label: string;
};

const NATAL_HINT =
  /พื้นดวง(?:เดิม)?|ดวงกำเนิด|ดวงจักรกำเนิด|ลัคนา(?:ฉัน|ผม|เกิด)?|ทักษาเกิด|ในดวง(?:ผม|ฉัน|เกิด)|โครงสร้างดวง/;

const TRANSIT_HINT =
  /ดวงจร|วันจร|ช่วงนี้|ตอนนี้|วันนี้|พรุ่งนี้|เดือนนี้|เดือนหน้า|สัปดาห์|ปีนี้|ปีหน้า|อนาคต|อีก\s*\d+\s*เดือน|ช่วง\s*\d+\s*เดือน|[3๓]\s*เดือน|สามเดือน|จะ(?:เป็น|ได้|มี|ไป|เจอ)|เมื่อ(?:ไหร่|ไร)|จังหวะ/;

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

export function bangkokDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function bangkokTimeHm(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function bangkokCivilDate(
  year: number,
  month: number,
  day: number,
  time = "12:00",
): Date {
  return new Date(
    `${year}-${pad2(month)}-${pad2(day)}T${time.padStart(5, "0")}:00+07:00`,
  );
}

function partsOf(date: Date): { y: number; m: number; d: number; hm: string } {
  const [y, m, d] = bangkokDateKey(date).split("-").map(Number);
  return { y, m, d, hm: bangkokTimeHm(date) };
}

export function addCalendarMonths(date: Date, months: number): Date {
  const { y, m, d, hm } = partsOf(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return bangkokCivilDate(ny, nm, Math.min(d, last), hm);
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function toCeYear(year: number): number {
  return year > 2400 ? year - 543 : year;
}

function parseExplicitDate(question: string, now: Date): Date | null {
  const slash = question.match(
    /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/,
  );
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = toCeYear(Number(slash[3]!.length === 2 ? `25${slash[3]}` : slash[3]));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return bangkokCivilDate(year, month, day, bangkokTimeHm(now));
    }
  }

  for (const row of THAI_MONTHS) {
    for (const key of row.keys) {
      const re = new RegExp(
        `(\\d{1,2})\\s*${key.replace(".", "\\.")}\\s*(\\d{4})?`,
        "i",
      );
      const hit = question.match(re);
      if (!hit) continue;
      const day = Number(hit[1]);
      const year = hit[2] ? toCeYear(Number(hit[2])) : partsOf(now).y;
      if (day >= 1 && day <= 31) {
        return bangkokCivilDate(year, row.month, day, bangkokTimeHm(now));
      }
    }
  }
  return null;
}

function parseOverride(raw?: string | Date | null): Date | null {
  if (!raw) return null;
  const d = typeof raw === "string" ? new Date(raw) : raw;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function detectReadingIntent(question: string): ReadingIntent {
  const q = question.trim();
  const wantsTransit = TRANSIT_HINT.test(q);
  const wantsNatal = NATAL_HINT.test(q);
  if (wantsTransit) return "transit";
  if (wantsNatal) return "natal";
  return "transit";
}

function windowOf(
  intent: ReadingIntent,
  start: Date,
  end: Date,
  label: string,
  sampleAt = start,
  horizonAt: Date | null = null,
): TransitWindow {
  return { intent, start, end, sampleAt, horizonAt, label };
}

function rangeLabel(phrase: string, start: Date, end: Date): string {
  const a = formatTransitDateLabel(start);
  const b = formatTransitDateLabel(end);
  if (a && b && a !== b) return `${phrase} (${a} – ${b})`;
  return a ? `${phrase} (${a})` : phrase;
}

/**
 * Decide natal vs future, then pick the civil Bangkok instant(s) to compute.
 * `override` is an explicit วันจร the user picked.
 */
export function resolveTransitWindow(
  question: string,
  now = new Date(),
  override?: string | Date | null,
): TransitWindow {
  const intent = detectReadingIntent(question);
  const picked = parseOverride(override);
  const q = question.trim();

  const monthsHit = q.match(/(?:ช่วง|อีก)?\s*(\d+|[3๓]|สาม)\s*เดือน/);
  const monthCount = monthsHit
    ? monthsHit[1] === "สาม" || monthsHit[1] === "๓"
      ? 3
      : Number(monthsHit[1])
    : null;

  if (intent === "natal" && !picked && !monthCount) {
    return windowOf(intent, now, now, "พื้นดวงเดิม", now, null);
  }

  const explicit = parseExplicitDate(q, now);
  if (picked && monthCount && Number.isFinite(monthCount)) {
    const end = addCalendarMonths(picked, monthCount);
    return windowOf(
      "transit",
      picked,
      end,
      rangeLabel(`ช่วง ${monthCount} เดือน`, picked, end),
      picked,
      end,
    );
  }
  if (picked) {
    return windowOf(
      "transit",
      picked,
      picked,
      formatTransitDateLabel(picked) ?? "วันจรที่เลือก",
      picked,
      null,
    );
  }
  if (explicit) {
    return windowOf(
      "transit",
      explicit,
      explicit,
      formatTransitDateLabel(explicit) ?? "วันจร",
      explicit,
      null,
    );
  }

  if (monthCount && Number.isFinite(monthCount) && monthCount > 0) {
    const end = addCalendarMonths(now, monthCount);
    return windowOf(
      "transit",
      now,
      end,
      rangeLabel(`ช่วง ${monthCount} เดือนนี้`, now, end),
      now,
      end,
    );
  }
  if (/เดือนหน้า/.test(q)) {
    const at = addCalendarMonths(now, 1);
    return windowOf("transit", at, at, rangeLabel("เดือนหน้า", at, at), at, null);
  }
  if (/ปีหน้า/.test(q)) {
    const at = addCalendarMonths(now, 12);
    return windowOf("transit", at, at, rangeLabel("ปีหน้า", at, at), at, null);
  }
  if (/พรุ่งนี้/.test(q)) {
    const at = addCalendarDays(now, 1);
    return windowOf("transit", at, at, rangeLabel("พรุ่งนี้", at, at), at, null);
  }
  if (/สัปดาห์หน้า/.test(q)) {
    const at = addCalendarDays(now, 7);
    return windowOf("transit", at, at, rangeLabel("สัปดาห์หน้า", at, at), at, null);
  }
  if (/สัปดาห์นี้/.test(q)) {
    const end = addCalendarDays(now, 7);
    return windowOf(
      "transit",
      now,
      end,
      rangeLabel("สัปดาห์นี้", now, end),
      now,
      end,
    );
  }

  return windowOf(
    intent,
    now,
    now,
    formatTransitDateLabel(now) ?? "วันนี้",
    now,
    null,
  );
}
