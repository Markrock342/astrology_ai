import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/rbac";
import { requestStopGeneration } from "@/server/horoscope/message-service";

const bodySchema = z.object({
  idempotencyKey: z.string().min(1).max(200),
});

/**
 * POST /api/conversations/[id]/stop — the user pressed stop.
 *
 * Deliberately separate from the client simply disconnecting: a refresh or a
 * closed tab must let the answer finish generating in the background, while a
 * stop must actually cancel it. The generating request polls this flag, so the
 * stop still lands when it hits a different serverless instance.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { idempotencyKey } = bodySchema.parse(await req.json());

    const stopped = await requestStopGeneration({
      conversationId: id,
      userId: user.id,
      idempotencyKey,
    });
    if (!stopped) throw new AppError("NOT_FOUND", "ไม่พบคำตอบที่กำลังสร้างอยู่");

    return ok({ stopped: true });
  });
}
