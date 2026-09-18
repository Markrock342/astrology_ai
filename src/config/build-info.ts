/**
 * Which build is running. `builtAt` is stamped into the bundle by
 * next.config.ts and always works. `commit` is best effort: the platform has to
 * expose it, at build time or in the running container's environment — Coolify
 * does neither by default, and "unknown" is the honest answer then.
 */
const COMMIT_VARS = [
  "BUILD_COMMIT",
  "SOURCE_COMMIT",
  "COOLIFY_GIT_COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
] as const;

/** Read at request time, so a commit present only in the container still shows. */
export function runtimeCommit(): string {
  for (const name of COMMIT_VARS) {
    const value = process.env[name];
    if (value) return value.slice(0, 12);
  }
  return "unknown";
}

export const BUILD_INFO = {
  commit: runtimeCommit(),
  builtAt: process.env.BUILD_TIME ?? new Date().toISOString(),
} as const;
