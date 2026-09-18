/**
 * Stamped at build time. Coolify/Nixpacks expose the commit as SOURCE_COMMIT;
 * other hosts use their own name, so a few are read in order. Unknown is a
 * valid answer — it means the platform gave the build no commit id.
 */
const commit =
  process.env.SOURCE_COMMIT ??
  process.env.COOLIFY_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "unknown";

export const BUILD_INFO = {
  commit: commit.slice(0, 12),
  builtAt: process.env.BUILD_TIME ?? new Date().toISOString(),
} as const;
