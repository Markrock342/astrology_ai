import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";
import { getEffectivePlan } from "@/server/user/account-service";
import { createReading, streamReading } from "@/server/horoscope/reading-service";
import {
  appendUserMessage,
  createPendingAssistant,
  finalizeAssistantMessage,
  loadPriorMessages,
} from "@/server/horoscope/thread-service";
import type { ConversationMode } from "@prisma/client";

export type SendMessageInput = {
  conversationId: string;
  userId: string;
  content: string;
  idempotencyKey: string;
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
    }
  | { status: "pending"; conversationId: string; idempotencyKey: string };

async function assertCanSend(
  conversationId: string,
  userId: string,
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { category: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  const plan = await getEffectivePlan(userId);
  if (plan !== "PRO") {
    throw new AppError(
      "CHAT_REQUIRES_PRO",
      "ต้องอัปเกรดเป็น Pro ก่อนจึงจะสนทนากับ AI ได้",
    );
  }

  if (conversation.category.accessLevel === "PRO" && plan !== "PRO") {
    throw new AppError("CATEGORY_LOCKED", "This category is for Pro members");
  }

  if (conversation.mode === "TRANSIT" && plan !== "PRO") {
    throw new AppError("TRANSIT_REQUIRES_PRO", "โหมดดวงจรสำหรับสมาชิก Pro");
  }

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

  // Unstick zombie PENDING rows left when serverless after() was killed mid-AI.
  await prisma.message.updateMany({
    where: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 2 * 60_000) },
    },
    data: {
      status: "FAILED",
      content:
        "ระบบใช้เวลานานเกินไปหรือถูกตัดการเชื่อมต่อ กรุณาลองถามใหม่อีกครั้ง (ไม่ถูกหักเครดิต)",
    },
  });

  const existingAssistant = await prisma.message.findUnique({
    where: {
      conversationId_idempotencyKey: {
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

  if (existingAssistant) {
    if (existingAssistant.status === "PENDING") {
      return {
        status: "pending",
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
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
      };
    }

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
    };
  }

  await appendUserMessage({
    conversationId: conversation.id,
    userId: input.userId,
    userContent: input.content,
  });
  await createPendingAssistant({
    conversationId: conversation.id,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
  });

  return {
    status: "pending",
    conversationId: conversation.id,
    idempotencyKey: input.idempotencyKey,
  };
}

/** Run AI + finalize the PENDING assistant (called from `after()` or SSE stream). */
export async function completePendingMessage(
  input: SendMessageInput,
  onDelta?: (chunk: string) => void,
  signal?: AbortSignal,
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
          },
          onDelta,
          signal,
        )
      : await createReading({
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
