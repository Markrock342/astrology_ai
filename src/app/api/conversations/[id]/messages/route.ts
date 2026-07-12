import { after } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/rbac";
import {
  acceptMessage,
  completePendingMessage,
  isStopRequested,
} from "@/server/horoscope/message-service";

export const maxDuration = 300;

const bodySchema = z.object({
  content: z.string().min(1),
});

function sseEncode(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Accept a user message.
 * - Prefer SSE streaming when Accept includes text/event-stream (Khui-like).
 * - Legacy: 202 + after() background when client does not request stream.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const wantStream = (req.headers.get("Accept") ?? "").includes(
    "text/event-stream",
  );

  if (!wantStream) {
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

  // SSE happy path — stream tokens on the same request.
  try {
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // The client can vanish mid-answer (refresh, tab close, flaky mobile
        // network). Generation must carry on regardless — the message row is
        // PENDING until it finalizes, and a row nobody finalizes hangs forever.
        // So writing to a dead stream is a no-op, never an error.
        const send = (event: Record<string, unknown>) => {
          if (req.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(sseEncode(event)));
          } catch {
            /* client already gone */
          }
        };
        const close = () => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        try {
          if (accepted.status === "ready") {
            const text = accepted.reading.responseText ?? "";
            if (text) send({ type: "delta", text });
            send({
              type: "done",
              reading: {
                id: accepted.reading.id,
                responseText: accepted.reading.responseText,
                modelId: accepted.reading.modelId,
                provider: accepted.reading.provider,
                creditCost: accepted.reading.creditCost,
                status: accepted.reading.status,
                chartSnapshot: accepted.reading.chartSnapshot ?? null,
                transitSnapshot: accepted.reading.transitSnapshot ?? null,
              },
            });
            close();
            return;
          }

          send({ type: "status", status: "started" });

          const generation = completePendingMessage(
            {
              conversationId: id,
              userId: user.id,
              content,
              idempotencyKey,
            },
            (chunk) => {
              send({ type: "delta", text: chunk });
            },
            // Only an explicit POST /stop cancels the answer. A dropped
            // connection must not — see the note on `send` above.
            () => isStopRequested(id, idempotencyKey),
          );

          // Keep the instance alive until generation settles even if the client
          // disconnects, so the PENDING row always gets finalized. Without this,
          // a refresh mid-answer strands the message as "generating" forever.
          after(() =>
            generation.catch((err) => {
              console.error("[chat-sse]", err);
            }),
          );

          const reading = await generation;

          send({
            type: "done",
            reading: {
              id: reading?.id,
              responseText: reading?.responseText ?? null,
              modelId: reading?.modelId ?? null,
              provider: reading?.provider ?? null,
              creditCost: reading?.creditCost ?? 0,
              status: reading?.status ?? "SUCCESS",
              chartSnapshot:
                reading && "chartSnapshot" in reading
                  ? reading.chartSnapshot
                  : null,
              transitSnapshot:
                reading && "transitSnapshot" in reading
                  ? reading.transitSnapshot
                  : null,
            },
          });
          close();
        } catch (err) {
          const code = err instanceof AppError ? err.code : "AI_PROVIDER_ERROR";
          const message =
            err instanceof AppError
              ? err.message
              : err instanceof Error
                ? err.message
                : "AI request failed";
          send({ type: "error", code, message });
          close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return handle(async () => {
      throw err;
    });
  }
}
