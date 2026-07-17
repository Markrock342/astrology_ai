import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";
import { getEffectivePlan } from "@/server/user/account-service";
import { assertCanRequestReading } from "@/server/horoscope/access-policy";
import { createReading, streamReading } from "@/server/horoscope/reading-service";
import type {
  ChatChartSnapshots,
  ChatPrepPhase,
} from "@/server/horoscope/reading-service";
import {
  appendUserMessage,
  createPendingAssistant,
  editUserMessage,
  finalizeAssistantMessage,
  loadPriorMessages,
  prepareRegenerateAssistant,
} from "@/server/horoscope/thread-service";
import type { ConversationMode } from "@prisma/client";

/**
 * Superseded turns (edited question / regenerated answer) are hidden, not
 * destroyed — see thread-service. Every query here must exclude them, or a
 * discarded branch walks back into the thread, the quota count, or the prompt.
 */
const LIVE = { deletedAt: null } as const;

export type SendMessageInput = {
  conversationId: string;
  userId: string;
  content: string;
  idempotencyKey: string;
  /** Update an existing user message and re-run AI (no new user row). */
  editUserMessageId?: string;
  /** Drop an assistant answer and re-run for the prior user question. */
  regenerateAssistantMessageId?: string;
  answerMode?: "brief" | "detailed";
};

export type AcceptMessageResult =
  | {
      status: "ready";
      reading: {
        id: string;
        responseText: string | null;
        provider: string | null;
        modelId: string | null;
        creditCost: number;
        status: string;
        chartSnapshot?: unknown;
        transitSnapshot?: unknown;
      };
      /** Same contract as the pending branch — a replayed turn must still be
       *  editable/regenerable, which needs the real row ids. */
      userMessageId?: string;
      assistantMessageId?: string;
    }
  | {
      status: "pending";
      conversationId: string;
      idempotencyKey: string;
      /** Real DB ids — the client swaps them onto its optimistic bubbles so
       *  edit/regenerate can address the rows that actually exist. */
      userMessageId?: string;
      assistantMessageId?: string;
    };

async function assertCanSend(
  conversationId: string,
  userId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { category: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  // A thread that already has turns means this send is a follow-up, which Free
  // does not get — the chart, the knowledge docs and the history are re-sent on
  // every turn, so an unbounded free thread is an unbounded free bill.
  const priorTurns = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      status: "SUCCESS",
      ...LIVE,
    },
  });

  await assertCanRequestReading({
    userId,
    categoryAccessLevel: conversation.category.accessLevel,
    mode: conversation.mode,
    isFollowUp: priorTurns > 0,
  });

  return conversation;
}

/**
 * Accept a chat turn quickly: persist USER + PENDING assistant, return 202-style
 * pending so the client can leave. AI runs via `completePendingMessage`.
 */
export async function acceptMessage(
  input: SendMessageInput,
): Promise<AcceptMessageResult> {
  const conversation = await assertCanSend(input.conversationId, input.userId);

  let question = input.content.trim();
  let skipUserAppend = false;

  if (input.editUserMessageId) {
    const edited = await editUserMessage(
      input.userId,
      input.editUserMessageId,
      question,
    );
    if (edited.conversationId !== conversation.id) {
      throw new AppError("VALIDATION", "ข้อความไม่อยู่ในเธรดนี้");
    }
    question = edited.content;
    skipUserAppend = true;
  } else if (input.regenerateAssistantMessageId) {
    const prepared = await prepareRegenerateAssistant(
      input.userId,
      input.regenerateAssistantMessageId,
    );
    if (prepared.conversationId !== conversation.id) {
      throw new AppError("VALIDATION", "ข้อความไม่อยู่ในเธรดนี้");
    }
    question = prepared.content;
    skipUserAppend = true;
  }

  // Unstick zombie PENDING rows left when serverless after() was killed mid-AI.
  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      status: "PENDING",
      ...LIVE,
      createdAt: { lt: new Date(Date.now() - 90_000) },
    },
    data: {
      status: "FAILED",
      content:
        "ระบบใช้เวลานานเกินไปหรือถูกตัดการเชื่อมต่อ กรุณาลองถามใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
    },
  });

  // A new user turn supersedes any other in-flight assistant placeholder.
  // stopRequested aborts the generation that is still running (the SSE loop
  // polls it) BEFORE it charges — marking the row FAILED alone left the model
  // running, so the credit was still deducted and the discarded answer could
  // reappear. Releasing the key stops finalize from re-matching this dead row.
  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      status: "PENDING",
      ...LIVE,
      idempotencyKey: { not: input.idempotencyKey },
    },
    data: {
      status: "FAILED",
      content: "ถูกยกเลิกเพราะมีคำถามใหม่ (ไม่ถูกหักเครดิต)",
      creditCost: 0,
      stopRequested: true,
      idempotencyKey: null,
    },
  });

  // findFirst, not findUnique: the unique key cannot express `deletedAt: null`,
  // and a superseded row must not be mistaken for this turn's live placeholder.
  const existingAssistant = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      idempotencyKey: input.idempotencyKey,
      ...LIVE,
    },
  });

  if (existingAssistant) {
    if (existingAssistant.status === "PENDING") {
      return {
        status: "pending",
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
        assistantMessageId: existingAssistant.id,
      };
    }
    if (
      existingAssistant.status === "FAILED" ||
      existingAssistant.status === "TIMEOUT"
    ) {
      await prisma.message.update({
        where: { id: existingAssistant.id },
        data: { status: "PENDING", content: "", creditCost: 0 },
      });
      return {
        status: "pending",
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
        assistantMessageId: existingAssistant.id,
      };
    }

    // The question this answer belongs to — the client needs both ids or the
    // replayed turn renders with no edit/regenerate/thumbs at all.
    const priorUser = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        role: "USER",
        ...LIVE,
        createdAt: { lt: existingAssistant.createdAt },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const messageIds = {
      userMessageId: priorUser?.id,
      assistantMessageId: existingAssistant.id,
    };

    const reading = await prisma.horoscopeReading.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (reading) {
      return {
        status: "ready",
        reading: {
          id: reading.id,
          responseText: reading.responseText,
          provider: reading.provider,
          modelId: reading.modelId,
          creditCost: reading.creditCost,
          status: reading.status,
        },
        ...messageIds,
      };
    }
    return {
      status: "ready",
      reading: {
        id: existingAssistant.id,
        responseText: existingAssistant.content,
        provider: existingAssistant.provider,
        modelId: existingAssistant.modelId,
        creditCost: existingAssistant.creditCost,
        status: existingAssistant.status,
      },
      ...messageIds,
    };
  }

  let userMessageId: string | undefined;
  if (!skipUserAppend) {
    const appended = await appendUserMessage({
      conversationId: conversation.id,
      userId: input.userId,
      userContent: question,
    });
    userMessageId = appended.id;
  } else if (input.editUserMessageId) {
    // Editing reuses the existing row — it already carries a real id.
    userMessageId = input.editUserMessageId;
  }
  const assistant = await createPendingAssistant({
    conversationId: conversation.id,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    status: "pending",
    conversationId: conversation.id,
    idempotencyKey: input.idempotencyKey,
    userMessageId,
    assistantMessageId: assistant.id,
  };
}

/**
 * Mark an in-flight assistant answer as stop-requested. Ownership is checked via
 * the conversation, and only a PENDING row can be stopped, so a late stop cannot
 * corrupt an answer that already finished.
 */
export async function requestStopGeneration(input: {
  conversationId: string;
  userId: string;
  idempotencyKey: string;
}): Promise<boolean> {
  const pending = await prisma.message.findFirst({
    where: {
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      role: "ASSISTANT",
      status: "PENDING",
      ...LIVE,
      conversation: { userId: input.userId },
    },
    select: { id: true, createdAt: true, content: true },
  });
  if (!pending) return false;

  // Past the AI's own ~30s cap there is no generation left to receive the flag,
  // so the row would sit PENDING forever. Close it out here instead — otherwise
  // pressing stop on a stranded turn does nothing, which is what it looked like.
  const stranded = Date.now() - pending.createdAt.getTime() > 90_000;
  if (stranded) {
    await prisma.message.update({
      where: { id: pending.id },
      data: {
        stopRequested: true,
        status: "FAILED",
        content:
          pending.content ||
          "หยุดการทำนายแล้ว (ไม่ถูกหักเครดิตเพราะยังไม่มีคำตอบ)",
        creditCost: 0,
      },
    });
    return true;
  }

  await prisma.message.update({
    where: { id: pending.id },
    data: { stopRequested: true },
  });
  return true;
}

/** True once the user has pressed stop for this answer. Polled while streaming. */
export async function isStopRequested(
  conversationId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const row = await prisma.message.findFirst({
    where: { conversationId, idempotencyKey, ...LIVE },
    select: { stopRequested: true },
  });
  return row?.stopRequested === true;
}

/** Run AI + finalize the PENDING assistant (called from `after()` or SSE stream). */
export async function completePendingMessage(
  input: SendMessageInput,
  onDelta?: (chunk: string) => void,
  shouldStop?: () => Promise<boolean>,
  onPhase?: (phase: ChatPrepPhase) => void,
  onCharts?: (charts: ChatChartSnapshots) => void,
) {
  const conversation = await assertCanSend(input.conversationId, input.userId);

  const pending = await prisma.message.findUnique({
    where: {
      conversationId_idempotencyKey: {
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (!pending) return;
  if (pending.status === "SUCCESS" && pending.content) {
    if (onDelta) onDelta(pending.content);
    return {
      id: pending.id,
      responseText: pending.content,
      provider: pending.provider,
      modelId: pending.modelId,
      creditCost: pending.creditCost,
      status: pending.status,
      chartSnapshot: null,
      transitSnapshot: null,
    };
  }

  const priorMessages = await loadPriorMessages(conversation.id, input.userId);

  try {
    const reading = onDelta
      ? await streamReading(
          {
            userId: input.userId,
            categorySlug: conversation.category.slug,
            question: input.content,
            idempotencyKey: input.idempotencyKey,
            priorMessages,
            mode: conversation.mode,
            transit:
              conversation.mode === "TRANSIT" && conversation.transitDate
                ? {
                    date: conversation.transitDate,
                    time: conversation.transitTime,
                    country: conversation.transitCountry,
                    province: conversation.transitProvince,
                    district: conversation.transitDistrict,
                  }
                : null,
            answerMode: input.answerMode,
            onPhase,
            onCharts,
          },
          onDelta,
          shouldStop,
        )
      : await createReading({
          userId: input.userId,
          categorySlug: conversation.category.slug,
          question: input.content,
          idempotencyKey: input.idempotencyKey,
          priorMessages,
          mode: conversation.mode,
          answerMode: input.answerMode,
          onPhase,
          onCharts,
          transit:
            conversation.mode === "TRANSIT" && conversation.transitDate
              ? {
                  date: conversation.transitDate,
                  time: conversation.transitTime,
                  country: conversation.transitCountry,
                  province: conversation.transitProvince,
                  district: conversation.transitDistrict,
                }
              : null,
        });

    await finalizeAssistantMessage({
      conversationId: conversation.id,
      idempotencyKey: input.idempotencyKey,
      content: reading.responseText ?? "",
      status: reading.status,
      provider: reading.provider ?? undefined,
      modelId: reading.modelId,
      creditCost: reading.creditCost,
    });

    return reading;
  } catch (err) {
    const message =
      err instanceof AppError
        ? err.message
        : "ระบบทำนายขัดข้องชั่วคราว ลองถามใหม่อีกครั้ง";
    await finalizeAssistantMessage({
      conversationId: conversation.id,
      idempotencyKey: input.idempotencyKey,
      content: message,
      status: "FAILED",
      creditCost: 0,
    });
    throw err;
  }
}

/**
 * @deprecated Prefer acceptMessage + completePendingMessage for background gen.
 * Kept for tests / sync callers — still runs AI inline then finalizes.
 */
export async function sendMessage(input: SendMessageInput) {
  const accepted = await acceptMessage(input);
  if (accepted.status === "ready") return accepted.reading;
  return completePendingMessage(input);
}

export type CreateConversationInput = {
  userId: string;
  categorySlug: string;
  mode?: ConversationMode;
  transitDate?: string;
  transitTime?: string;
  transitCountry?: string;
  transitProvince?: string;
  transitDistrict?: string;
};

/** Create a new chat thread (natal or transit). Transit is Pro-only. */
export async function createConversation(input: CreateConversationInput) {
  const plan = await getEffectivePlan(input.userId);
  const mode = input.mode ?? "NATAL";

  if (mode === "TRANSIT" && plan !== "PRO") {
    throw new AppError("TRANSIT_REQUIRES_PRO", "โหมดดวงจรสำหรับสมาชิก Pro");
  }

  const category = await prisma.horoscopeCategory.findFirst({
    where: { slug: input.categorySlug, enabled: true },
  });
  if (!category) throw new AppError("NOT_FOUND", "Category not available");

  if (category.accessLevel === "PRO" && plan !== "PRO") {
    throw new AppError("CATEGORY_LOCKED", "This category is for Pro members");
  }

  const transitDate = input.transitDate ? new Date(input.transitDate) : null;
  const title =
    mode === "TRANSIT" && transitDate && !Number.isNaN(transitDate.getTime())
      ? `ดวงจร ${transitDate.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })}`
      : null;

  const conversation = await prisma.conversation.create({
    data: {
      userId: input.userId,
      categoryId: category.id,
      mode,
      title,
      transitDate,
      transitTime: input.transitTime ?? null,
      transitCountry: input.transitCountry ?? null,
      transitProvince: input.transitProvince ?? null,
      transitDistrict: input.transitDistrict ?? null,
    },
    include: { category: true },
  });
  invalidateUserBootstrap(input.userId);
  return conversation;
}
