import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { birthProfileSchema } from "@/lib/schemas";
import {
  getBirthProfile,
  getEditsRemaining,
  isStaffRole,
  upsertBirthProfile,
} from "@/server/user/birth-profile-service";

/** Current user's birth profile + how many edits remain (rule: edit once more). */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const profile = await getBirthProfile(user.id);
    const unlimited = isStaffRole(user.role);
    const editsRemaining = getEditsRemaining(profile?.editCount, { unlimited });
    return ok({ profile, editsRemaining, unlimitedEdits: unlimited });
  });
}

/**
 * Create or update the birth profile. Year (พ.ศ./ค.ศ.) is normalized to
 * Gregorian and stored in UTC by the service; editing is limited to once more
 * for normal users. ADMIN / SUPER_ADMIN may edit unlimited times.
 */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const data = birthProfileSchema.parse(await req.json());
    const unlimited = isStaffRole(user.role);
    const profile = await upsertBirthProfile(user.id, data, {
      unlimitedEdits: unlimited,
    });
    const editsRemaining = getEditsRemaining(profile.editCount, { unlimited });
    return ok({ profile, editsRemaining, unlimitedEdits: unlimited });
  });
}
