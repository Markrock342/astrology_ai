import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/rbac";
import { buildDayCalendar, CALENDAR_TOPICS, type CalendarTopic } from "@/server/horoscope/day-calendar-service";

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "เดือนต้องอยู่ในรูป YYYY-MM"),
  topic: z.enum(Object.keys(CALENDAR_TOPICS) as [CalendarTopic, ...CalendarTopic[]]).default("general"),
});

/** GET /api/me/day-calendar?month=2026-10&topic=work — each day scored against the user's chart. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`day-calendar:${user.id}`, 60, 60_000);
    const { month, topic } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const [year, m] = month.split("-").map(Number) as [number, number];
    if (year < 1941 || year > 2100 || m < 1 || m > 12) {
      return ok({ year, month: m, topic, days: [], bestDates: [] });
    }
    return ok(await buildDayCalendar(user.id, { year, month: m, topic }));
  });
}
