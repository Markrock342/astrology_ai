import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  getAppBootstrap,
  getAppBootstrapLight,
} from "@/server/app/bootstrap-service";

/**
 * One round-trip for the authenticated app shell sidebar.
 * `?scope=light` — me + threads only (after chat send / poll complete).
 */
export async function GET(req: Request) {
  return handle(async () => {
    const sessionUser = await requireUser();
    const scope = new URL(req.url).searchParams.get("scope");
    if (scope === "light") {
      return ok(await getAppBootstrapLight(sessionUser.id));
    }
    return ok(await getAppBootstrap(sessionUser.id));
  });
}
