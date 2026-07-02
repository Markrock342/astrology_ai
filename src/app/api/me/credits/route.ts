import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getBalance } from "@/server/credit/credit-service";

/** Remaining credit / quota for the current user. Never exposes raw tokens. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const balance = await getBalance(user.id);
    return ok({ balance });
  });
}
