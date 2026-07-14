import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import {
  clearMessageFeedback,
  submitMessageFeedback,
} from "@/server/horoscope/feedback-service";

const bodySchema = z.object({
  value: z.enum(["UP", "DOWN"]),
  reason: z.string().max(500).optional(),
});

/** POST /api/messages/:id/feedback — thumbs up/down on an assistant answer. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { value, reason } = bodySchema.parse(await req.json());
    return ok(
      await submitMessageFeedback({
        userId: user.id,
        messageId: id,
        value,
        reason,
      }),
    );
  });
}

/** DELETE /api/messages/:id/feedback — withdraw the verdict. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return ok(await clearMessageFeedback(user.id, id));
  });
}
