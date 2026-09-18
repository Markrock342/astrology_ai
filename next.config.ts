import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/**
 * Stamped into the bundle at build time so /api/version can say which commit is
 * serving. Coolify did not pass SOURCE_COMMIT through to the Nixpacks build, so
 * the checkout itself is asked as a fallback. "unknown" is a valid answer.
 */
function buildCommit(): string {
  const fromEnv =
    process.env.SOURCE_COMMIT ??
    process.env.COOLIFY_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
      .slice(0, 12);
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    BUILD_COMMIT: buildCommit(),
    BUILD_TIME: new Date().toISOString(),
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.horasard.com" }],
        destination: "https://horasard.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
