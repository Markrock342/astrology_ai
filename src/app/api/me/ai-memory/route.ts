import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  getUserAiMemory,
  resetUserAiMemory,
  setUserAiMemoryEnabled,
} from "@/server/user/ai-memory-service";

const updateSchema = z.object({ enabled: z.boolean() });

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await getUserAiMemory(user.id));
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { enabled } = updateSchema.parse(await request.json());
    return ok(await setUserAiMemoryEnabled(user.id, enabled));
  });
}

/** Forget chat-derived context without deleting the user's visible history. */
export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await resetUserAiMemory(user.id));
  });
}
