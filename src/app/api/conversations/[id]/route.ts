import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getThreadDetail } from "@/server/horoscope/thread-service";

/** Restore a past thread (user + assistant messages). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await getThreadDetail(user.id, id));
  });
}
