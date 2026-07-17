import { DISPLAY_TIMEZONE } from "@/config/constants";

/** Difference between the Buddhist (พ.ศ.) and Gregorian (ค.ศ.) calendars. */
export const BUDDHIST_YEAR_OFFSET = 543;

export type YearEra = "BE" | "CE";

/** Read a UTC instant as calendar fields in the configured display timezone. */
export function getDisplayDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

/**
 * Storage is always UTC (business rule 13). Use these helpers for display in
 * Thailand time. Prefer Intl over hard-coded offsets so DST/edge cases stay
 * correct if the timezone ever changes.
 */
export function formatThai(date: Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: DISPLAY_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(date);
}

/**
 * Normalize a birth year to Gregorian (ค.ศ.). The client may send either era:
 * an explicit `era` wins; otherwise a value that is clearly too large to be a
 * plausible Gregorian birth year (>= 2200) is treated as Buddhist.
 */
export function toGregorianYear(year: number, era?: YearEra): number {
  if (era === "CE") return year;
  if (era === "BE") return year - BUDDHIST_YEAR_OFFSET;
  return year >= 2200 ? year - BUDDHIST_YEAR_OFFSET : year;
}

/**
 * Build a UTC Date from Thai birth date/time parts. Year is normalized to
 * Gregorian first, then the wall-clock time in Asia/Bangkok (UTC+7, no DST) is
 * converted to a real UTC instant so storage stays in UTC (rule 13).
 */
export function buildBirthDateUtc(parts: {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour?: number; // 0-23
  minute?: number; // 0-59
  era?: YearEra;
}): Date {
  const gYear = toGregorianYear(parts.year, parts.era);
  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  // Asia/Bangkok is a fixed UTC+7 offset (no DST), so subtract 7h from the
  // local wall-clock time to get the UTC instant.
  const BANGKOK_OFFSET_HOURS = 7;
  return new Date(
    Date.UTC(gYear, parts.month - 1, parts.day, hour - BANGKOK_OFFSET_HOURS, minute),
  );
}
