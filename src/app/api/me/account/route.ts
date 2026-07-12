import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { deleteMyAccount } from "@/server/user/account-deletion-service";

/** DELETE /api/me/account — self-serve PDPA account deletion. */
export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    await deleteMyAccount(user.id);
    return ok({ deleted: true });
  });
}
