import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { cancelActiveSubscription } from "@/server/user/profile-service";

/** Cancel active Pro subscription (settings popover). */
export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await cancelActiveSubscription(user.id));
  });
}
