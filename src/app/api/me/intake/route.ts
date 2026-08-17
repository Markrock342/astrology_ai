import { handle, ok } from "@/lib/http";
import { upsertIntakeSchema } from "@/lib/intake-survey";
import { requireUser } from "@/server/auth/rbac";
import { getIntake, upsertIntake } from "@/server/user/intake-service";
import { getBirthProfile } from "@/server/user/birth-profile-service";
import { AppError } from "@/lib/errors";

/** Current user's signup survey, if completed. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const intake = await getIntake(user.id);
    return ok({ intake });
  });
}

/** Create or replace the signup survey answers. Birth profile must exist first. */
export async function PUT(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const profile = await getBirthProfile(user.id);
    if (!profile) {
      throw new AppError("VALIDATION", "กรุณากรอกข้อมูลวันเกิดก่อนทำแบบสำรวจ");
    }
    const body = upsertIntakeSchema.parse(await req.json());
    const intake = await upsertIntake(user.id, body.answers);
    return ok({ intake });
  });
}
