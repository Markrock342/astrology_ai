import { after } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/rbac";
import {
  acceptMessage,
  completePendingMessage,
} from "@/server/horoscope/message-service";

export const maxDuration = 60;

const bodySchema = z.object({
  content: z.string().min(1),
});

/** Accept a user message; AI completes in background via `after()`. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`chat:${user.id}`, 10, 60_000);
    const { id } = await ctx.params;
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new AppError("VALIDATION", "Idempotency-Key header is required");
    }
    const { content } = bodySchema.parse(await req.json());

    const accepted = await acceptMessage({
      conversationId: id,
      userId: user.id,
      content,
      idempotencyKey,
    });

    if (accepted.status === "ready") {
      return ok(accepted.reading);
    }

    after(() => {
      void completePendingMessage({
        conversationId: id,
        userId: user.id,
        content,
        idempotencyKey,
      }).catch((err) => {
        console.error("[chat-after]", err);
      });
    });

    return ok(
      {
        status: "pending",
        conversationId: id,
        idempotencyKey,
      },
      { status: 202 },
    );
  });
}
