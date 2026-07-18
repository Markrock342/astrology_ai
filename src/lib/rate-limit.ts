import { AppError } from "./errors";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Distributed rate limiter with Upstash Redis (M4 B3) and in-memory fallback.
 *
 * When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, limits are
 * enforced across all Vercel instances. Otherwise falls back to per-process memory
 * (fine for local dev / single instance).
 *
 * Auth paths should pass `{ failClosed: true }` so Redis outages reject instead
 * of allowing unlimited login attempts.
 */

/**
 * Best-effort client IP for rate-limit bucketing.
 *
 * Prefer platform-set headers (`x-real-ip` / `x-vercel-forwarded-for`) which the
 * client cannot spoof, then the LEFTMOST `x-forwarded-for` entry. NEVER key on
 * the whole `x-forwarded-for` string: an attacker who sends a random XFF header
 * each request would mint a fresh bucket every time and defeat the limit
 * entirely. Absent all headers, everything collides on "local" (dev/self-host).
 */
export function rateLimitIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const vercel = req.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (vercel) return vercel;
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  return "local";
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

let redisClient: Redis | null | undefined;
const ratelimitCache = new Map<string, Ratelimit>();

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

function getRedis(): Redis {
  if (redisClient === undefined) {
    redisClient = upstashConfigured() ? Redis.fromEnv() : null;
  }
  if (!redisClient) {
    throw new Error("Upstash Redis is not configured");
  }
  return redisClient;
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  const cached = ratelimitCache.get(cacheKey);
  if (cached) return cached;

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: "horasard:rl",
    analytics: false,
  });
  ratelimitCache.set(cacheKey, limiter);
  return limiter;
}

/** In-memory limiter used for dev fallback and unit tests. */
export function memoryRateLimit(key: string, limit: number, windowMs: number): void {
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

/** Which backend is active for observability / docs. */
export function getRateLimitBackend(): "upstash" | "memory" {
  return upstashConfigured() ? "upstash" : "memory";
}

export type RateLimitOptions = {
  /**
   * When Upstash is configured but Redis errors, reject the request instead of
   * failing open. Use for auth endpoints.
   */
  failClosed?: boolean;
};

/**
 * Enforce a sliding-window request limit. Throws RATE_LIMITED when exceeded.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options?: RateLimitOptions,
): Promise<void> {
  if (!upstashConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[rate-limit] CRITICAL: Upstash unset in production — using per-instance memory (set UPSTASH_*)",
      );
    }
    memoryRateLimit(key, limit, windowMs);
    return;
  }

  try {
    const { success } = await getUpstashLimiter(limit, windowMs).limit(key);
    if (!success) {
      throw new AppError("RATE_LIMITED", "Too many requests, please slow down");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[rate-limit] Upstash error:", err);
    if (options?.failClosed || process.env.NODE_ENV === "production") {
      throw new AppError(
        "RATE_LIMITED",
        "ระบบจำกัดคำขอขัดข้องชั่วคราว กรุณาลองใหม่ในอีกสักครู่",
      );
    }
    // Dev only: fail open so local work continues without Redis.
  }
}

/** @internal test helper */
export function resetMemoryRateLimitForTests(): void {
  buckets.clear();
}
