import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getEffectivePlan } from "@/server/user/account-service";
import { createReading } from "@/server/horoscope/reading-service";
import type { ConversationMode } from "@prisma/client";

export type SendMessageInput = {
  conversationId: string;
  userId: string;
  content: string;
  idempotencyKey: string;
};

/**
 * Send a message in an existing conversation thread.
 * Phase 1: delegates to the reading pipeline (HoroscopeReading) while the
 * Conversation/Message tables are wired for full multi-turn chat in Wave C+.
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

  const reading = await createReading({
    userId: input.userId,
    categorySlug: conversation.category.slug,
    question: input.content,
    idempotencyKey: input.idempotencyKey,
  });

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: input.content,
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: reading.responseText ?? "",
        idempotencyKey: input.idempotencyKey,
        provider: reading.provider,
        modelId: reading.modelId ?? undefined,
        creditCost: reading.creditCost,
        status: reading.status,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    }),
  ]);

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
