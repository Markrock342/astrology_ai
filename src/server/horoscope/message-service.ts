import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getEffectivePlan } from "@/server/user/account-service";
import { createReading } from "@/server/horoscope/reading-service";
import {
  appendExchangeToConversation,
  loadPriorMessages,
} from "@/server/horoscope/thread-service";
import type { ConversationMode } from "@prisma/client";

export type SendMessageInput = {
  conversationId: string;
  userId: string;
  content: string;
  idempotencyKey: string;
};

/**
 * Send a message in an existing conversation thread.
 * Loads prior messages for multi-turn context and persists USER + ASSISTANT rows.
 */
export async function sendMessage(input: SendMessageInput) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    include: { category: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  const plan = await getEffectivePlan(input.userId);
  if (plan !== "PRO") {
    throw new AppError(
      "CHAT_REQUIRES_PRO",
      "ต้องอัปเกรดเป็น Pro ก่อนจึงจะสนทนากับ AI ได้",
    );
  }

  if (conversation.mode === "TRANSIT" && plan !== "PRO") {
    throw new AppError("TRANSIT_REQUIRES_PRO", "โหมดดวงจรสำหรับสมาชิก Pro");
  }

  const existingAssistant = await prisma.message.findUnique({
    where: {
      conversationId_idempotencyKey: {
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existingAssistant) {
    const reading = await prisma.horoscopeReading.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (reading) return reading;
    return {
      id: existingAssistant.id,
      responseText: existingAssistant.content,
      provider: existingAssistant.provider,
      modelId: existingAssistant.modelId,
      creditCost: existingAssistant.creditCost,
      status: existingAssistant.status,
    };
  }

  const priorMessages = await loadPriorMessages(conversation.id, input.userId);

  const reading = await createReading({
    userId: input.userId,
    categorySlug: conversation.category.slug,
    question: input.content,
    idempotencyKey: input.idempotencyKey,
    priorMessages,
  });

  await appendExchangeToConversation({
    conversationId: conversation.id,
    userId: input.userId,
    userContent: input.content,
    idempotencyKey: input.idempotencyKey,
    assistantContent: reading.responseText ?? "",
    provider: reading.provider ?? undefined,
    modelId: reading.modelId,
    creditCost: reading.creditCost,
    status: reading.status,
  });

  return reading;
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

  return prisma.conversation.create({
    data: {
      userId: input.userId,
      categoryId: category.id,
      mode,
      transitDate: input.transitDate ? new Date(input.transitDate) : null,
      transitTime: input.transitTime ?? null,
      transitCountry: input.transitCountry ?? null,
      transitProvince: input.transitProvince ?? null,
      transitDistrict: input.transitDistrict ?? null,
    },
    include: { category: true },
  });
}
