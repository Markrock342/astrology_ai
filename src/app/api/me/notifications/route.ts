import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/rbac";

const bodySchema = z.object({ weeklyDaysEmail: z.boolean() });

/** GET/PATCH /api/me/notifications — the Monday good-days email switch. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { weeklyDaysEmail: true } });
    return ok({ weeklyDaysEmail: row?.weeklyDaysEmail ?? false });
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { weeklyDaysEmail } = bodySchema.parse(await req.json());
    await prisma.user.update({ where: { id: user.id }, data: { weeklyDaysEmail } });
    return ok({ weeklyDaysEmail });
  });
}
