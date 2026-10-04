import { handle, ok } from "@/lib/http";
import { assertCronAuth } from "@/server/cron-auth";
import {
  countOverduePendingPayments,
  runSlipRetentionSweep,
} from "@/server/payment/slip-retention-service";

/**
 * GET/POST /api/cron/slip-retention — Vercel Cron + manual trigger.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  return handle(async () => {
    assertCronAuth(req);
    const retention = await runSlipRetentionSweep();
    const pendingOverdue48h = await countOverduePendingPayments(48);
    const pendingOverdue3d = await countOverduePendingPayments(72);
    if (pendingOverdue3d > 0) {
      console.warn(
        `[cron/slip-retention] ${pendingOverdue3d} PENDING payments older than 3 days`,
      );
    }
    return ok({ retention, pendingOverdue48h, pendingOverdue3d });
  });
}

export async function POST(req: Request) {
  return GET(req);
}
