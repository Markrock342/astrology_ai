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
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content: z.string().min(1),
  editUserMessageId: z.string().optional(),
  regenerateAssistantMessageId: z.string().optional(),
  answerMode: z.enum(["brief", "detailed"]).optional().default("detailed"),
});

function sseEncode(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Split a model chunk so proxies flush more often. The client typewriter
 * already smooths per-character — tiny 24-char slices just flooded the wire
 * (~170 events per answer) for no visual gain.
 */
function emitDeltaChunks(
  send: (event: Record<string, unknown>) => void,
  text: string,
) {
  if (text.length <= 192) {
    send({ type: "delta", text });
    return;
  }
  const size = 96;
  for (let i = 0; i < text.length; i += size) {
    send({ type: "delta", text: text.slice(i, i + size) });
  }
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
      const { content, editUserMessageId, regenerateAssistantMessageId, answerMode } =
        bodySchema.parse(await req.json());

      const accepted = await acceptMessage({
        conversationId: id,
        userId: user.id,
        content,
        idempotencyKey,
        editUserMessageId,
        regenerateAssistantMessageId,
        answerMode,
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
          answerMode,
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

  // Auth + body first, then open SSE immediately so the client can show
  // "กำลังเพ่งดวงดาว…" while accept/generate runs — not a blank hang.
  try {
    const user = await requireUser();
    await rateLimit(`chat:${user.id}`, 10, 60_000);
    const { id } = await ctx.params;
    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new AppError("VALIDATION", "Idempotency-Key header is required");
    }
    const { content, editUserMessageId, regenerateAssistantMessageId, answerMode } =
      bodySchema.parse(await req.json());

    const encoder = new TextEncoder();
    // Wall-clock for the whole turn (accept + chart + model), reported on `done`
    // so the finished answer can say how long it actually took.
    const turnStartedAt = Date.now();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const send = (event: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(sseEncode(event)));
          } catch {
            closed = true;
          }
        };
        const close = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        // Heartbeat keeps intermediaries from buffering the whole answer.
        const heartbeat = setInterval(() => {
          send({ type: "ping" });
        }, 1500);

        try {
          const accepted = await acceptMessage({
            conversationId: id,
            userId: user.id,
            content,
            idempotencyKey,
            editUserMessageId,
            regenerateAssistantMessageId,
            answerMode,
          });

          if (accepted.status === "ready") {
            const text = accepted.reading.responseText ?? "";
            if (text) emitDeltaChunks(send, text);
            send({
              type: "done",
              elapsedMs: Date.now() - turnStartedAt,
              // A replayed turn is still a real turn — without the ids the
              // client leaves it with no edit/regenerate/thumbs, forever.
              messageIds: {
                user: accepted.userMessageId ?? null,
                assistant: accepted.assistantMessageId ?? null,
              },
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
              followUps: [],
              creditCost: accepted.reading.creditCost,
            });
            close();
            return;
          }

          // Hand the real row ids over BEFORE generating. Sending them only on
          // `done` meant a turn that was stopped or errored never learned them,
          // and the client hides every action (edit, regenerate, even copy) on a
          // bubble with no server id.
          send({
            type: "accepted",
            messageIds: {
              user: accepted.userMessageId ?? null,
              assistant: accepted.assistantMessageId ?? null,
            },
          });

          const generation = completePendingMessage(
            {
              conversationId: id,
              userId: user.id,
              content,
              idempotencyKey,
              answerMode,
            },
            (chunk) => {
              emitDeltaChunks(send, chunk);
            },
            () => isStopRequested(id, idempotencyKey),
            (phase) => {
              send({ type: "status", phase });
            },
          );

          after(() =>
            generation.catch((err) => {
              console.error("[chat-sse]", err);
            }),
          );

          const reading = await generation;

          // Send `done` the instant the answer is finalized — the caret drops,
          // actions appear, and the turn settles without waiting on meta.
          send({
            type: "done",
            elapsedMs: Date.now() - turnStartedAt,
            // Real row ids for the optimistic bubbles the client is showing —
            // without these, edit/regenerate address ids that never existed.
            messageIds: {
              user: accepted.userMessageId ?? null,
              assistant: accepted.assistantMessageId ?? null,
            },
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
            followUps: [],
            creditCost: reading?.creditCost ?? 0,
          });

          // Follow-up chips + summary line arrive as a separate frame once the
          // Flash-Lite meta call lands — never blocking the answer above.
          const metaPromise = (
            reading as {
              metaPromise?: Promise<{
                summaryLine?: string;
                followUps?: string[];
              }>;
            } | null | undefined
          )?.metaPromise;
          if (metaPromise) {
            try {
              const meta = await metaPromise;
              send({
                type: "meta",
                ...(meta?.summaryLine ? { summaryLine: meta.summaryLine } : {}),
                followUps: meta?.followUps ?? [],
              });
            } catch {
              /* meta is best-effort — the answer already shipped */
            }
          }
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
        } finally {
          clearInterval(heartbeat);
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
