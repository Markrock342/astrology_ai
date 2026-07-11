import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  getRateLimitBackend,
  memoryRateLimit,
  rateLimit,
  resetMemoryRateLimitForTests,
} from "@/lib/rate-limit";

describe("memoryRateLimit (M4 B3)", () => {
  afterEach(() => {
    resetMemoryRateLimitForTests();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows requests within the limit", () => {
    expect(() => memoryRateLimit("user-a", 3, 60_000)).not.toThrow();
    expect(() => memoryRateLimit("user-a", 3, 60_000)).not.toThrow();
    expect(() => memoryRateLimit("user-a", 3, 60_000)).not.toThrow();
  });

  it("throws RATE_LIMITED when limit is exceeded", () => {
    memoryRateLimit("user-b", 2, 60_000);
    memoryRateLimit("user-b", 2, 60_000);
    expect(() => memoryRateLimit("user-b", 2, 60_000)).toThrowError(
      expect.objectContaining({ code: "RATE_LIMITED" } satisfies Partial<AppError>),
    );
  });

  it("uses separate buckets per key", () => {
    memoryRateLimit("key-1", 1, 60_000);
    expect(() => memoryRateLimit("key-1", 1, 60_000)).toThrow();
    expect(() => memoryRateLimit("key-2", 1, 60_000)).not.toThrow();
  });

  it("rateLimit() uses memory backend when Upstash env is unset", async () => {
    expect(getRateLimitBackend()).toBe("memory");
    await expect(rateLimit("async-key", 5, 60_000)).resolves.toBeUndefined();
  });
});
