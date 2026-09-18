/**
 * Stamped at build time by next.config.ts, which reads the platform's commit
 * variable or falls back to the checkout itself. Unknown is a valid answer — it
 * means the build had neither.
 */
const commit =
  process.env.BUILD_COMMIT ??
  process.env.SOURCE_COMMIT ??
  process.env.COOLIFY_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "unknown";

export const BUILD_INFO = {
  commit: commit.slice(0, 12),
  builtAt: process.env.BUILD_TIME ?? new Date().toISOString(),
} as const;
