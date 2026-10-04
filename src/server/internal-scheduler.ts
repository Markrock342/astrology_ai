import { runSlipRetentionSweep } from "@/server/payment/slip-retention-service";
import { runWeeklyDaysEmails } from "@/server/notify/weekly-days-service";

/**
 * The jobs vercel.json schedules, run by the server itself. The site moved to
 * Coolify, which never read vercel.json — the PDPA slip sweep had stopped
 * running. Both jobs are safe to run again (the sweep only touches slips past
 * retention; the weekly email claims each person's week), so each instance
 * simply checks every 15 minutes whether one is due.
 */
const TICK_MS = 15 * 60_000;
let started = false;
let lastSweep = 0;

function bangkokNow(now = new Date()) {
  const b = new Date(now.getTime() + 7 * 3_600_000);
  return { weekday: b.getUTCDay(), hour: b.getUTCHours() };
}

export async function runDueJobs(now = new Date()): Promise<string[]> {
  const ran: string[] = [];
  if (now.getTime() - lastSweep >= 20 * 3_600_000) {
    lastSweep = now.getTime();
    const r = await runSlipRetentionSweep(now);
    ran.push(`slip-retention ${JSON.stringify(r)}`);
  }
  const { weekday, hour } = bangkokNow(now);
  if (weekday === 1 && hour >= 7) {
    const r = await runWeeklyDaysEmails({ now });
    if (r.candidates) ran.push(`weekly-days ${JSON.stringify(r)}`);
  }
  return ran;
}

export function startInternalScheduler(): void {
  if (started) return;
  started = true;
  const tick = () =>
    runDueJobs()
      .then((ran) => ran.forEach((line) => console.info(`[scheduler] ${line}`)))
      .catch((err) => console.error("[scheduler]", err instanceof Error ? err.message : err));
  // First run a little after boot, off the request path.
  setTimeout(tick, 2 * 60_000).unref?.();
  setInterval(tick, TICK_MS).unref?.();
}
