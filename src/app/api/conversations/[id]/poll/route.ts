import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { pollThreadForUser } from "@/server/horoscope/thread-service";

/** GET /api/conversations/:id/poll — lightweight status while AI reply is pending. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await pollThreadForUser(user.id, id));
  });
}
