import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  deleteConversation,
  getThreadDetail,
} from "@/server/horoscope/thread-service";

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

/** Delete a conversation thread owned by the current user. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    return ok(await deleteConversation(user.id, id));
  });
}
