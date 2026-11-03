/**
 * Runs once per server start. Starts the in-process scheduler for the daily
 * slip sweep and the Monday email (see server/internal-scheduler) — in a
 * production Node server only; INTERNAL_SCHEDULER=off turns it off when a
 * platform cron calls /api/cron/* instead.
 */
export async function register() {
  // Keep the import inside a positive runtime branch so webpack can exclude
  // Node-only crypto/scheduler modules from its Edge instrumentation bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production" && process.env.INTERNAL_SCHEDULER !== "off") {
      const { startInternalScheduler } = await import("@/server/internal-scheduler");
      startInternalScheduler();
    }
  }
}
