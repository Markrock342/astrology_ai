import { DISPLAY_TIMEZONE } from "@/config/constants";

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
