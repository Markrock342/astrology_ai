import { DISPLAY_TIMEZONE } from "@/config/constants";

/** Banner / thread title date in Thailand, never UTC (midnight would slip a day). */
export function formatTransitDateLabel(date: Date | string): string | null {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIMEZONE,
  });
}

export function formatTransitTimeLabel(date: Date | string): string | null {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", {
    timeZone: DISPLAY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

export function formatTransitThreadLabel(
  date: Date | string,
  time?: string | null,
): string | null {
  const dateLabel = formatTransitDateLabel(date);
  if (!dateLabel) return time?.trim() || null;
  const hm = time?.trim();
  return hm ? `${dateLabel} · ${hm}` : dateLabel;
}

/** Banner stamp at the instant of a send — date + HH:mm:ss in Bangkok. */
export function formatTransitNowLabel(date: Date | string = new Date()): string | null {
  const time = formatTransitTimeLabel(date);
  return formatTransitThreadLabel(date, time);
}
