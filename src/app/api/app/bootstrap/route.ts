import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getAppBootstrap } from "@/server/app/bootstrap-service";

/**
 * One round-trip for the authenticated shell sidebar:
 * me + categories + natal/transit threads (+ announcements).
 */
export async function GET() {
  return handle(async () => {
    const sessionUser = await requireUser();
    return ok(await getAppBootstrap(sessionUser.id));
  });
}
