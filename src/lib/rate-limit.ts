import { AppError } from "./errors";

/**
 * Minimal in-memory rate limiter for auth and AI endpoints (spec 11).
 *
 * Production note (M4 B3): in-memory is intentional until PM chooses Upstash
 * Redis. Safe for single-instance / demo; multi-instance Vercel may under-limit.
 * See docs/backend_m4_waitlist.md — do not swap implementation without PM sign-off.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests, please slow down");
  }
}
