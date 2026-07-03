import { z } from "zod";
import { AppError } from "@/lib/errors";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { sendMessage } from "@/server/horoscope/message-service";

const bodySchema = z.object({
  content: z.string().min(1),
});

/** Send a user message in a conversation thread (Pro-only). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new AppError("VALIDATION", "Idempotency-Key header is required");
    }
    const { content } = bodySchema.parse(await req.json());
    const reading = await sendMessage({
      conversationId: id,
      userId: user.id,
      content,
      idempotencyKey,
    });
    return ok(reading);
  });
}
