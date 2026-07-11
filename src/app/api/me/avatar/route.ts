import { handle, ok, fail } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { updateUserAvatar } from "@/server/user/avatar-service";

/** Upload or replace profile photo (email/password accounts). */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return fail("VALIDATION", "กรุณาเลือกไฟล์รูป", 422);
    }

    return ok(await updateUserAvatar(user.id, file));
  });
}
