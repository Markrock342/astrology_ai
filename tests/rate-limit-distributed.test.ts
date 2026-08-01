import { afterEach, describe, expect, it, vi } from "vitest";
import {
  memoryRateLimit,
  rateLimit,
  resetMemoryRateLimitForTests,
} from "@/lib/rate-limit";

describe("rateLimit requireDistributed", () => {
  afterEach(() => {
    resetMemoryRateLimitForTests();
    vi.unstubAllEnvs();
  });

  it("falls back to memory (does NOT block auth) when production lacks Upstash by default", async () => {
    // Regression: requireDistributed used to THROW here, which took production
    // login/register/reset fully offline whenever Upstash wasn't configured.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("AUTH_RATELIMIT_STRICT", "");
    await expect(
      rateLimit("login:test", 20, 60_000, { requireDistributed: true }),
    ).resolves.toBeUndefined();
  });

  it("hard-blocks auth only when AUTH_RATELIMIT_STRICT is opted in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("AUTH_RATELIMIT_STRICT", "true");
    await expect(
      rateLimit("login:strict", 20, 60_000, { requireDistributed: true }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("allows memory fallback in development without Upstash", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(
      rateLimit("login:dev", 20, 60_000, { requireDistributed: true }),
    ).resolves.toBeUndefined();
    memoryRateLimit("x", 1, 60_000);
    expect(() => memoryRateLimit("x", 1, 60_000)).toThrow();
  });
});
