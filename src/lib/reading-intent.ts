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

const TRANSIT_HINT =
  /ดวงจร|วันจร|ช่วงนี้|ตอนนี้|วันนี้|พรุ่งนี้|เดือนนี้|เดือนหน้า|สัปดาห์|ปีนี้|ปีหน้า|อนาคต|อีก\s*\d+\s*เดือน|ช่วง\s*\d+\s*เดือน|[3๓]\s*เดือน|สามเดือน|จะ(?:เป็น|ได้|มี|ไป|เจอ)|เมื่อ(?:ไหร่|ไร)|จังหวะ/;

export const FUTURE_DATE_PROMPT_TRIGGERS = [
  "explicit_date",
  "tomorrow",
  "day_after_tomorrow",
  "week_current",
  "week_next",
  "month_current",
  "month_next",
  "year_current",
  "year_next",
  "relative_period",
  "when",
  "future",
  "future_outcome",
  "current_period",
] as const;

export type FutureDatePromptTrigger =
  (typeof FUTURE_DATE_PROMPT_TRIGGERS)[number];

export const FUTURE_DATE_PROMPT_TRIGGER_LABELS: Record<
  FutureDatePromptTrigger,
  string
> = {
  explicit_date: "ระบุวันที่ตรงๆ",
  tomorrow: "พรุ่งนี้",
  day_after_tomorrow: "มะรืน",
  week_current: "สัปดาห์นี้",
  week_next: "สัปดาห์หน้า",
  month_current: "เดือนนี้",
  month_next: "เดือนหน้า",
  year_current: "ปีนี้",
  year_next: "ปีหน้า",
  relative_period: "ช่วงเวลา / อีก N วันเดือนปี",
  when: "เมื่อไหร่ / เมื่อไร",
  future: "อนาคต",
  future_outcome: "จะได้ / จะมี / มีโอกาส",
  current_period: "ช่วงนี้ / ตอนนี้ ขณะที่เลือกวันจรไว้แล้ว",
};

/** "ช่วงนี้ / ตอนนี้ / วันนี้" — only ambiguous once another วันจร is already picked. */
export const CURRENT_PERIOD_PATTERN = /ช่วงนี้|ตอนนี้|วันนี้|ระยะนี้/;

const THAI_NUMBER_WORDS: Record<string, number> = {
  หนึ่ง: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
  สิบ: 10,
};
const COUNT_SRC = "(\\d+|[๐-๙]+|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)";
const UNIT_SRC = "(วัน|สัปดาห์|เดือน|ปี)";
/** "อีก 2 วัน", "ช่วง 3 เดือน", "ภายใน 5 วัน" */
const RELATIVE_PREFIX = new RegExp(`(อีก|ช่วง|ภายใน)\\s*${COUNT_SRC}\\s*${UNIT_SRC}`);
/** "สองวันข้างหน้า", "2 วันถัดไป", "3 สัปดาห์ต่อจากนี้" — no "อีก" needed. */
const RELATIVE_SUFFIX = new RegExp(
  `${COUNT_SRC}\\s*${UNIT_SRC}\\s*(ข้างหน้า|ถัดไป|ต่อจากนี้|ต่อไป|นับจากนี้)`,
);

function parseCount(raw: string): number {
  const word = THAI_NUMBER_WORDS[raw];
  if (word) return word;
  return Number(raw.replace(/[๐-๙]/g, (d) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d))));
}

export type RelativeSpan = {
  count: number;
  unit: "day" | "week" | "month" | "year";
  /** "ช่วง/ภายใน N" is a window from today; the rest point at one day. */
  range: boolean;
  phrase: string;
};

const UNIT_BY_WORD: Record<string, RelativeSpan["unit"]> = {
  วัน: "day",
  สัปดาห์: "week",
  เดือน: "month",
  ปี: "year",
};

/** "อีก N วัน" / "N วันข้างหน้า" → how far ahead the user is asking about. */
export function parseRelativeSpan(question: string): RelativeSpan | null {
  const prefix = question.match(RELATIVE_PREFIX);
  if (prefix) {
    const count = parseCount(prefix[2]!);
    if (!Number.isFinite(count) || count <= 0) return null;
    return {
      count,
      unit: UNIT_BY_WORD[prefix[3]!]!,
      range: prefix[1] === "ช่วง" || prefix[1] === "ภายใน",
      phrase: prefix[0],
    };
  }
  const suffix = question.match(RELATIVE_SUFFIX);
  if (suffix) {
    const count = parseCount(suffix[1]!);
    if (!Number.isFinite(count) || count <= 0) return null;
    return {
      count,
      unit: UNIT_BY_WORD[suffix[2]!]!,
      range: false,
      phrase: suffix[0],
    };
  }
  return null;
}

/** Ordered from most specific to broadest so one prompt produces one safe tag. */
/**
 * Client's keyword table (Sep 2026). Everything is measured in DAYS from
 * today, which is always the starting point. Users found the date pop-up
 * unsmooth, so a phrase that names a period resolves to a day by itself and
 * the chat just answers; the calendar button stays for picking a day by hand.
 *
 * Ordered: the first pattern that matches wins, so a phrase carrying a count
 * ("อีก 2-3 ปี") must come before the bare unit ("ปี").
 */
const TIME_KEYWORD_RULES: ReadonlyArray<{
  pattern: RegExp;
  days: number;
  label: string;
}> = [
  // "ครึ่งปีนี้" carries "ปีนี้" inside it, so it has to be tested first.
  { pattern: /ครึ่งปี|6\s*เดือน|หกเดือน/, days: 180, label: "ครึ่งปี" },
  // Year
  { pattern: /อีก\s*[2-3๒-๓](?:\s*[-–]\s*[2-3๒-๓])?\s*ปี/, days: 730, label: "อีก 2 ปี" },
  { pattern: /ปีหน้า/, days: 365, label: "ปีหน้า" },
  { pattern: /ปีที่แล้ว|ปีก่อน/, days: -365, label: "ปีที่แล้ว" },
  { pattern: /ปีนี้/, days: 0, label: "ปีนี้" },
  // Month
  { pattern: /อีก\s*[2-3๒-๓](?:\s*[-–]\s*[2-3๒-๓])?\s*เดือน|[2-3๒-๓]\s*[-–]\s*[2-3๒-๓]\s*เดือน/, days: 60, label: "อีก 2 เดือน" },
  { pattern: /เดือนหน้า/, days: 30, label: "เดือนหน้า" },
  { pattern: /เดือนที่แล้ว|เดือนก่อน/, days: -30, label: "เดือนที่แล้ว" },
  { pattern: /เดือนนี้/, days: 0, label: "เดือนนี้" },
  // Week
  { pattern: /(?:สัปดาห์|อาทิตย์|week|weekend)\s*หน้า/i, days: 7, label: "สัปดาห์หน้า" },
  { pattern: /(?:สัปดาห์|อาทิตย์|week)\s*ที่แล้ว|(?:สัปดาห์|อาทิตย์)ก่อน/i, days: -7, label: "สัปดาห์ที่แล้ว" },
  { pattern: /(?:สัปดาห์|อาทิตย์|week)\s*นี้/i, days: 0, label: "สัปดาห์นี้" },
  // Day
  { pattern: /มะรืน/, days: 2, label: "มะรืนนี้" },
  { pattern: /พรุ่งนี้/, days: 1, label: "พรุ่งนี้" },
  { pattern: /เมื่อวาน|เมื่อวานนี้/, days: -1, label: "เมื่อวานนี้" },
  { pattern: /ช่วงนี้|ตอนนี้|วันนี้|ระยะนี้/, days: 0, label: "ช่วงนี้" },
];

export type TimeKeywordHit = { at: Date; days: number; label: string };

/** The day a time phrase points at, counted from today. */
export function resolveTimeKeyword(
  question: string,
  now = new Date(),
): TimeKeywordHit | null {
  const q = question.trim();
  if (!q) return null;
  const rule = TIME_KEYWORD_RULES.find(({ pattern }) => pattern.test(q));
  if (!rule) return null;
  return { at: addCalendarDays(now, rule.days), days: rule.days, label: rule.label };
}

const FUTURE_DATE_PROMPT_RULES: ReadonlyArray<{
  trigger: FutureDatePromptTrigger;
  pattern: RegExp;
}> = [
  {
    trigger: "explicit_date",
    pattern:
      /วันที่\s*\d{1,2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}\s*(?:ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?)/,
  },
  { trigger: "day_after_tomorrow", pattern: /มะรืน/ },
  { trigger: "tomorrow", pattern: /พรุ่งนี้/ },
  { trigger: "week_next", pattern: /สัปดาห์หน้า/ },
  { trigger: "week_current", pattern: /สัปดาห์นี้/ },
  { trigger: "month_next", pattern: /เดือนหน้า/ },
  { trigger: "month_current", pattern: /เดือนนี้/ },
  { trigger: "year_next", pattern: /ปีหน้า/ },
  { trigger: "year_current", pattern: /ปีนี้/ },
  {
    trigger: "relative_period",
    pattern: new RegExp(`${RELATIVE_PREFIX.source}|${RELATIVE_SUFFIX.source}`),
  },
  { trigger: "when", pattern: /เมื่อ(?:ไหร่|ไร)/ },
  { trigger: "future", pattern: /อนาคต/ },
  {
    trigger: "future_outcome",
    pattern: /(?:จะ|มีโอกาส)(?:ได้|มี|เจอ|พบ|เกิด|เปลี่ยน|ย้าย|แต่ง|ดีขึ้น|สำเร็จ)/,
  },
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

/**
 * A question is a transit question only when it points at time or the future
 * (ช่วงนี้ / เดือนหน้า / จะได้…ไหม / เมื่อไหร่ …). Anything else — "จุดแข็งของฉัน",
 * "การงานเป็นยังไง" — is read from the natal chart. A user-picked date still
 * wins in resolveTransitWindow regardless of wording.
 */
export function detectReadingIntent(question: string): ReadingIntent {
  const q = question.trim();
  if (TRANSIT_HINT.test(q)) return "transit";
  // Every wording the future-date modal recognises (มะรืน, สองวันข้างหน้า,
  // อีก ๕ วัน, วันที่ 20/10 …) is a transit question too.
  if (detectFutureDatePromptTrigger(q)) return "transit";
  return "natal";
}

export function detectFutureDatePromptTrigger(
  question: string,
): FutureDatePromptTrigger | null {
  const q = question.trim();
  if (!q) return null;
  return FUTURE_DATE_PROMPT_RULES.find(({ pattern }) => pattern.test(q))
    ?.trigger ?? null;
}

export function shouldPromptForFutureDate(question: string): boolean {
  return detectFutureDatePromptTrigger(question) !== null;
}

/** Suggested date shown in the confirmation modal; the user remains in control. */
export function suggestedFutureDateKey(
  question: string,
  now = new Date(),
): string {
  return bangkokDateKey(resolveTransitWindow(question, now).sampleAt);
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

  // The client's keyword table decides the day whenever a phrase names one.
  // Anything with an explicit count ("อีก 5 วัน") still goes through
  // parseRelativeSpan below, which handles arbitrary numbers.
  const keyword = resolveTimeKeyword(q, now);
  if (keyword && !parseRelativeSpan(q)) {
    return windowOf(
      "transit",
      keyword.at,
      keyword.at,
      rangeLabel(keyword.label, keyword.at, keyword.at),
      keyword.at,
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
  // "อีก 2 วัน", "สองวันข้างหน้า", "อีก 3 สัปดาห์", "ช่วง 5 วัน" — months are
  // handled by monthCount above, which also covers "อีก N เดือน".
  const span = parseRelativeSpan(q);
  if (span && span.unit !== "month") {
    const at =
      span.unit === "year"
        ? addCalendarMonths(now, 12 * span.count)
        : addCalendarDays(now, span.count * (span.unit === "week" ? 7 : 1));
    if (span.range) {
      return windowOf("transit", now, at, rangeLabel(span.phrase, now, at), now, at);
    }
    return windowOf("transit", at, at, rangeLabel(span.phrase, at, at), at, null);
  }
  if (/เดือนหน้า/.test(q)) {
    const at = addCalendarMonths(now, 1);
    return windowOf("transit", at, at, rangeLabel("เดือนหน้า", at, at), at, null);
  }
  if (/ปีหน้า/.test(q)) {
    const at = addCalendarMonths(now, 12);
    return windowOf("transit", at, at, rangeLabel("ปีหน้า", at, at), at, null);
  }
  if (/มะรืน/.test(q)) {
    const at = addCalendarDays(now, 2);
    return windowOf("transit", at, at, rangeLabel("มะรืน", at, at), at, null);
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

/**
 * "Read my whole chart" rather than one question. The team's method walks 17
 * topics for this and one topic otherwise; deciding it here — not leaving it
 * to the model — is what keeps a single question from turning into a table of
 * contents, and an overview from stopping after two topics.
 */
const OVERVIEW_PATTERN =
  /ภาพรวม|ดูดวงทั้งหมด|ทุกด้าน|ทุกเรื่อง|ทุกหัวข้อ|ครบทุก|ดวงชะตาโดยรวม|ดวงโดยรวม|ดูดวงทั่วไป|พยากรณ์ทั้งหมด|ทั้งชีวิต/;

export function isOverviewQuestion(question: string): boolean {
  return OVERVIEW_PATTERN.test(question);
}
