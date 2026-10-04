import { requireReadyNatalChart } from "@/server/horoscope/chart-context";
import { scanDaysForChart } from "@/server/horoscope/day-scan-service";
import { bangkokCivilDate } from "@/lib/reading-intent";

/**
 * The month as a calendar: every day scored against the person's chart, the
 * same facts the chat's "วันไหนดีสุด" picks from — computed, no AI, so it is
 * free to show and to open as often as people like.
 */
export const CALENDAR_TOPICS = {
  general: { label: "ทั่วไป", houses: [1, 10, 11] },
  work: { label: "การงาน", houses: [10, 11] },
  money: { label: "การเงิน", houses: [2, 11] },
  love: { label: "ความรัก", houses: [7, 5] },
} as const;

export type CalendarTopic = keyof typeof CALENDAR_TOPICS;

export type CalendarDay = {
  date: string;
  weekday: string;
  dayRole: string | null;
  score: number;
  reasons: string[];
};

export async function buildDayCalendar(
  userId: string,
  input: { year: number; month: number; topic: CalendarTopic },
): Promise<{ year: number; month: number; topic: CalendarTopic; days: CalendarDay[]; bestDates: string[] }> {
  const natal = await requireReadyNatalChart(userId);
  const last = new Date(Date.UTC(input.year, input.month, 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => bangkokCivilDate(input.year, input.month, i + 1, "09:00"));
  const scan = scanDaysForChart({ natal, days, topicHouses: [...CALENDAR_TOPICS[input.topic].houses] });
  const iso = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  // Stars go on days still ahead: a best day already gone helps no one.
  const todayIso = iso(new Date());
  const ahead = (scan?.all ?? []).filter((d) => iso(d.date) >= todayIso && d.dayRole !== "กาลกิณี" && d.score > 0);
  const bestDates = (ahead.length ? ahead : (scan?.all ?? []).filter((d) => d.dayRole !== "กาลกิณี" && d.score > 0))
    .sort((a, b) => b.score - a.score || a.date.getTime() - b.date.getTime())
    .slice(0, 3)
    .map((d) => iso(d.date));
  return {
    year: input.year,
    month: input.month,
    topic: input.topic,
    days: (scan?.all ?? []).map((d) => ({
      date: iso(d.date),
      weekday: d.weekday,
      dayRole: d.dayRole,
      score: d.score,
      reasons: d.reasons,
    })),
    bestDates,
  };
}
