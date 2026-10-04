import { handle, ok } from "@/lib/http";
import { assertCronAuth } from "@/server/cron-auth";
import { runWeeklyDaysEmails } from "@/server/notify/weekly-days-service";

export const maxDuration = 300;

/**
 * GET/POST /api/cron/weekly-days — Monday morning. Authorization: Bearer CRON_SECRET.
 * Safe to run again: anyone sent within five days is skipped.
 */
export async function GET(req: Request) {
  return handle(async () => {
    assertCronAuth(req);
    return ok(await runWeeklyDaysEmails());
  });
}

export async function POST(req: Request) {
  return GET(req);
}
