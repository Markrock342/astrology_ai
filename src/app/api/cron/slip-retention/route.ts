import { timingSafeEqual } from "node:crypto";
import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import {
  countOverduePendingPayments,
  runSlipRetentionSweep,
} from "@/server/payment/slip-retention-service";

function assertCronAuth(req: Request): void {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new AppError("FORBIDDEN", "CRON_SECRET is not configured");
  }
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("UNAUTHENTICATED", "Invalid cron authorization");
  }
}

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
