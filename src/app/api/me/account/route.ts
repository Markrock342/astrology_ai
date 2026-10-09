import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { deleteMyAccount } from "@/server/user/account-deletion-service";

/**
 * DELETE /api/me/account — self-serve PDPA account deletion. Asks for the
 * password (or, for a Google account, the email typed out): a borrowed or
 * stolen session could delete the account in one request.
 */
export async function DELETE(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { password?: unknown; email?: unknown };
    await deleteMyAccount(user.id, {
      password: typeof body.password === "string" ? body.password : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
    });
    return ok({ deleted: true });
  });
}
