import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { changePasswordSchema } from "@/lib/schemas";
import { changePassword } from "@/server/user/profile-service";

/** Change password (settings popover). */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await req.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);
    return ok(await changePassword(user.id, currentPassword, newPassword));
  });
}
