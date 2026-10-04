import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { deleteMemoryFact } from "@/server/memory/fact-memory-service";
import { getUserAiMemory } from "@/server/user/ai-memory-service";

/** DELETE /api/me/ai-memory/facts/:id — forget one thing the AI remembered. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await deleteMemoryFact(user.id, id);
    return ok(await getUserAiMemory(user.id));
  });
}
