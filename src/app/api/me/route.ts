import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getMe } from "@/server/user/account-service";

/** Current user profile + effective plan + wallet snapshot (GET /api/me). */
export async function GET() {
  return handle(async () => {
    const sessionUser = await requireUser();
    return ok(await getMe(sessionUser.id));
  });
}
