import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { updateProfileSchema } from "@/lib/schemas";
import { updateDisplayName } from "@/server/user/profile-service";

/** Update display name (settings popover). */
export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await req.json();
    const { name } = updateProfileSchema.parse(body);
    return ok(await updateDisplayName(user.id, name));
  });
}
