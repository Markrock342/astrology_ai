import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import nextConfig from "../next.config";
import {
  authConfig,
  SESSION_MAX_AGE_SECONDS,
} from "@/server/auth/config";

type PackageLock = {
  packages: Record<string, { version?: string }>;
};

const packageLock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
) as PackageLock;

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

  it("locks the audited Next.js and Auth.js security releases", () => {
    expect(packageLock.packages["node_modules/next"]?.version).toBe("16.4.2");
    expect(packageLock.packages["node_modules/next-auth"]?.version).toBe("5.0.0-beta.32");
    expect(packageLock.packages["node_modules/@auth/core"]?.version).toBe("0.41.3");
    expect(packageLock.packages["node_modules/@auth/prisma-adapter"]?.version).toBe("2.11.3");
  });
});
