import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import {
  authConfig,
  SESSION_MAX_AGE_SECONDS,
} from "@/server/auth/config";

describe("persistent canonical authentication", () => {
  it("keeps JWT sessions persistent for 90 days", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(90 * 24 * 60 * 60);
    expect(authConfig.session?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    expect(authConfig.jwt?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("redirects www to the canonical host so host-only auth cookies do not split", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toContainEqual({
      source: "/:path*",
      has: [{ type: "host", value: "www.horasard.com" }],
      destination: "https://horasard.com/:path*",
      permanent: true,
    });
  });
});
