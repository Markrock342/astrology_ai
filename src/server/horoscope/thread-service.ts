import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { AIProvider, ConversationMode, ReadingStatus } from "@prisma/client";

export type ThreadSummary = {
  id: string;
  title: string;
  categorySlug: string;
  categoryLabel: string;
  createdAt: string;
};

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
};

export type ThreadDetail = {
  id: string;
  categorySlug: string;
  categoryLabel: string;
  mode: ConversationMode;
  messages: ThreadMessage[];
};

function truncateTitle(text: string, max = 48): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function mapConversationRows(
  rows: Array<{
    id: string;
    title: string | null;
    updatedAt: Date;
    category: { slug: string; nameTh: string };
    messages: Array<{ content: string }>;
  }>,
): ThreadSummary[] {
  return rows.map((c) => {
    const firstUser = c.messages[0]?.content;
    const title =
      c.title?.trim() ||
      (firstUser ? truncateTitle(firstUser) : c.category.nameTh);
    return {
      id: c.id,
      title,
      categorySlug: c.category.slug,
      categoryLabel: c.category.nameTh,
      createdAt: c.updatedAt.toISOString(),
    };
  });
}

/** List conversation threads for sidebar/history (natal or transit). */
export async function listConversationThreads(
  userId: string,
  mode: ConversationMode,
  limit = 50,
): Promise<ThreadSummary[]> {
  const rows = await prisma.conversation.findMany({
    where: { userId, mode },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      category: { select: { slug: true, nameTh: true } },
      messages: {
        where: { role: "USER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  return mapConversationRows(rows);
}

/** @deprecated Use listConversationThreads(userId, "TRANSIT"). */
export const listTransitThreads = (userId: string, limit?: number) =>
  listConversationThreads(userId, "TRANSIT", limit);

/** List natal conversation threads for sidebar/history. */
export const listUserThreads = (userId: string, limit?: number) =>
  listConversationThreads(userId, "NATAL", limit);

/** Restore a thread as ordered user + assistant messages. */
export async function getThreadDetail(
  userId: string,
  threadId: string,
): Promise<ThreadDetail> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: threadId, userId },
    select: {
      id: true,
      mode: true,
      category: { select: { slug: true, nameTh: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          modelId: true,
        },
      },
    },
  });

  if (conversation) {
    if (conversation.messages.length === 0) {
      throw new AppError("NOT_FOUND", "ไม่พบประวัติการสนทนานี้");
    }

    return {
      id: conversation.id,
      categorySlug: conversation.category.slug,
      categoryLabel: conversation.category.nameTh,
      mode: conversation.mode,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
        modelId: m.modelId ?? undefined,
      })),
    };
  }

  // Legacy: single Q&A stored as HoroscopeReading before full chat migration.
  const reading = await prisma.horoscopeReading.findFirst({
    where: { id: threadId, userId, status: "SUCCESS" },
    select: {
      id: true,
      question: true,
      responseText: true,
      modelId: true,
      category: { select: { slug: true, nameTh: true } },
    },
  });
  if (!reading?.responseText) {
    throw new AppError("NOT_FOUND", "ไม่พบประวัติการสนทนานี้");
  }

  return {
    id: reading.id,
    categorySlug: reading.category.slug,
    categoryLabel: reading.category.nameTh,
    mode: "NATAL",
    messages: [
      {
        id: `${reading.id}-user`,
        role: "user",
        content: reading.question,
      },
      {
        id: `${reading.id}-assistant`,
        role: "assistant",
        content: reading.responseText,
        modelId: reading.modelId ?? undefined,
      },
    ],
  };
}

export type AppendExchangeInput = {
  conversationId: string;
  userId: string;
  userContent: string;
  idempotencyKey: string;
  assistantContent: string;
  provider?: AIProvider;
  modelId?: string | null;
  creditCost: number;
  status: ReadingStatus;
};

/** Persist a user question + assistant answer on an existing conversation thread. */
export async function appendExchangeToConversation(input: AppendExchangeInput) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    select: { id: true, title: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  const existingAssistant = await prisma.message.findUnique({
    where: {
      conversationId_idempotencyKey: {
        conversationId: conversation.id,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existingAssistant) return;

  const title =
    conversation.title?.trim() ||
    truncateTitle(input.userContent);

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: input.userContent,
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: input.assistantContent,
        idempotencyKey: input.idempotencyKey,
        provider: input.provider,
        modelId: input.modelId ?? undefined,
        creditCost: input.creditCost,
        status: input.status,
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        ...(conversation.title ? {} : { title }),
      },
    }),
  ]);
}

/** Load prior thread messages for multi-turn prompt context. */
export async function loadPriorMessages(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
}
