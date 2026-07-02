import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getMyPackage } from "@/server/user/account-service";

/** Current user's effective package + subscription + credit balance. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await getMyPackage(user.id));
  });
}
