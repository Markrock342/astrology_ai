import { timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

/** Scheduled jobs call in with `Authorization: Bearer $CRON_SECRET`. */
export function assertCronAuth(req: Request): void {
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
