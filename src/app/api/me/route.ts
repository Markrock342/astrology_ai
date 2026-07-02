import { prisma } from "@/server/db";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";

/** Current user profile + effective package snapshot (spec: GET /api/me). */
export async function GET() {
  return handle(async () => {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        birthProfile: { select: { id: true, nickname: true } },
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { package: { select: { code: true, type: true } }, expiresAt: true },
        },
      },
    });
    return ok(user);
  });
}
