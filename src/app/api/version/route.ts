import { BUILD_INFO, runtimeCommit } from "@/config/build-info";

/**
 * GET /api/version — which build is actually serving.
 *
 * Public and unauthenticated on purpose: after a push there was no way to tell
 * whether production had picked the commit up, because everything that changes
 * lives behind the login.
 *
 * Dynamic, not static: Coolify gave the BUILD no commit id, but the running
 * container may still carry one in its environment. `builtAt` is stamped at
 * build time and is the reliable signal either way — compare it with the time
 * of the push.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ...BUILD_INFO, commit: runtimeCommit() },
    { headers: { "cache-control": "no-store" } },
  );
}
