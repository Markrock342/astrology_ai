/**
 * Runs once per server start. Starts the in-process scheduler for the daily
 * slip sweep and the Monday email (see server/internal-scheduler) — in a
 * production Node server only; INTERNAL_SCHEDULER=off turns it off when a
 * platform cron calls /api/cron/* instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.INTERNAL_SCHEDULER === "off") return;
  const { startInternalScheduler } = await import("@/server/internal-scheduler");
  startInternalScheduler();
}
