import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { listUserThreads } from "@/server/horoscope/thread-service";

/** Chat history threads (derived from past readings until full chat model ships). */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await listUserThreads(user.id));
  });
}
