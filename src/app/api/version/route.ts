import { BUILD_INFO } from "@/config/build-info";

/**
 * GET /api/version — which build is actually serving.
 *
 * Public and unauthenticated on purpose: after a push there was no way to tell
 * whether production had picked the commit up, because everything that changes
 * lives behind the login. Returns only a commit id and a build timestamp.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(BUILD_INFO, {
    headers: { "cache-control": "no-store" },
  });
}
