import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { MAX_PRIOR_MESSAGES_LOAD } from "@/config/constants";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";
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
  status?: "SUCCESS" | "FAILED" | "TIMEOUT" | "PENDING";
  /** Only on a PENDING assistant turn — lets the client stop it after a reload. */
  idempotencyKey?: string;
  /**
   * When the row was created. For a PENDING assistant this is when the turn
   * actually began — the client's own timer restarts whenever the indicator
   * remounts (switch chats and back, reload), so the elapsed counter has to be
   * derived from this instead of from mount time.
   */
  createdAt?: string;
};

export type ThreadDetail = {
  id: string;
  categorySlug: string;
  categoryLabel: string;
  mode: ConversationMode;
  messages: ThreadMessage[];
  transitDate?: string | null;
  transitTime?: string | null;
  transitCountry?: string | null;
  transitProvince?: string | null;
  transitDistrict?: string | null;
};

function truncateTitle(text: string, max = 48): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
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
    },
  });

  return rows.map((c) => ({
    id: c.id,
    title: c.title?.trim() || c.category.nameTh,
    categorySlug: c.category.slug,
    categoryLabel: c.category.nameTh,
    createdAt: c.updatedAt.toISOString(),
  }));
}

/** @deprecated Use listConversationThreads(userId, "TRANSIT"). */
export const listTransitThreads = (userId: string, limit?: number) =>
  listConversationThreads(userId, "TRANSIT", limit);

/** List natal conversation threads for sidebar/history. */
export const listUserThreads = (userId: string, limit?: number) =>
  listConversationThreads(userId, "NATAL", limit);

/** Alias used by FE F2 conversation list. */
export const listNatalThreads = listUserThreads;

/** Restore a thread as ordered user + assistant messages. */
export async function getThreadDetail(
  userId: string,
  threadId: string,
): Promise<ThreadDetail> {
  // Opening a thread is the moment a stranded turn is visible, so clear it here
  // too — waiting for the user's next message left the old one "generating".
  await sweepStalePendingAssistants(threadId);

  const conversation = await prisma.conversation.findFirst({
    where: { id: threadId, userId },
    select: {
      id: true,
      mode: true,
      transitDate: true,
      transitTime: true,
      transitCountry: true,
      transitProvince: true,
      transitDistrict: true,
      category: { select: { slug: true, nameTh: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          role: true,
          content: true,
          modelId: true,
          status: true,
          idempotencyKey: true,
          createdAt: true,
        },
      },
    },
  });

  if (conversation) {
    // Allow empty threads (e.g. just-created TRANSIT before first message).
    return {
      id: conversation.id,
      categorySlug: conversation.category.slug,
      categoryLabel: conversation.category.nameTh,
      mode: conversation.mode,
      transitDate: conversation.transitDate?.toISOString() ?? null,
      transitTime: conversation.transitTime,
      transitCountry: conversation.transitCountry,
      transitProvince: conversation.transitProvince,
      transitDistrict: conversation.transitDistrict,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role === "USER" ? "user" : "assistant" as const,
        content: m.content,
        modelId: m.modelId ?? undefined,
        status: m.status,
        // Exposed only while generating, so a reloaded tab can still stop it.
        idempotencyKey:
          m.status === "PENDING" ? (m.idempotencyKey ?? undefined) : undefined,
        createdAt: m.createdAt.toISOString(),
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

export type ThreadPollResult = {
  hasPending: boolean;
  messages: ThreadMessage[] | null;
};

/**
 * Lightweight poll while AI runs — skips full message history until PENDING clears.
 */
export async function pollThreadForUser(
  userId: string,
  threadId: string,
): Promise<ThreadPollResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: threadId, userId },
    select: { id: true },
  });
  if (!conversation) {
    throw new AppError("NOT_FOUND", "ไม่พบประวัติการสนทนานี้");
  }

  const pendingCount = await prisma.message.count({
    where: { conversationId: threadId, status: "PENDING" },
  });

  if (pendingCount > 0) {
    return { hasPending: true, messages: null };
  }

  const detail = await getThreadDetail(userId, threadId);
  return { hasPending: false, messages: detail.messages };
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

/** Delete a conversation owned by the user (messages cascade). */
export async function deleteConversation(userId: string, threadId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: threadId, userId },
    select: { id: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "ไม่พบประวัติการสนทนานี้");
  await prisma.conversation.delete({ where: { id: conversation.id } });
  invalidateUserBootstrap(userId);
  return { id: conversation.id };
}

/** Delete every conversation (natal + transit) owned by the user. */
export async function deleteAllConversations(userId: string) {
  const result = await prisma.conversation.deleteMany({ where: { userId } });
  invalidateUserBootstrap(userId);
  return { deleted: result.count };
}

/** Rename a conversation thread (sidebar title). */
export async function updateConversationTitle(
  userId: string,
  threadId: string,
  title: string,
) {
  const trimmed = title.trim();
  if (!trimmed) throw new AppError("VALIDATION", "ชื่อแชทต้องไม่ว่าง");

  const conversation = await prisma.conversation.findFirst({
    where: { id: threadId, userId },
    select: { id: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "ไม่พบประวัติการสนทนานี้");

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { title: truncateTitle(trimmed, 120), updatedAt: new Date() },
  });
  invalidateUserBootstrap(userId);
  return { id: conversation.id, title: truncateTitle(trimmed, 120) };
}

/** Delete a message and every message created after it in the same thread. */
export async function truncateMessagesFrom(
  userId: string,
  messageId: string,
): Promise<{ conversationId: string }> {
  const anchor = await prisma.message.findFirst({
    where: { id: messageId, conversation: { userId } },
    select: { id: true, conversationId: true, createdAt: true },
  });
  if (!anchor) throw new AppError("NOT_FOUND", "ไม่พบข้อความนี้");

  await prisma.message.deleteMany({
    where: {
      conversationId: anchor.conversationId,
      createdAt: { gte: anchor.createdAt },
    },
  });

  await prisma.conversation.update({
    where: { id: anchor.conversationId },
    data: { updatedAt: new Date() },
  });

  return { conversationId: anchor.conversationId };
}

/** Edit a user turn: update text and drop all later messages. */
export async function editUserMessage(
  userId: string,
  messageId: string,
  newContent: string,
): Promise<{ conversationId: string; content: string }> {
  const trimmed = newContent.trim();
  if (!trimmed) throw new AppError("VALIDATION", "ข้อความต้องไม่ว่าง");

  const message = await prisma.message.findFirst({
    where: { id: messageId, role: "USER", conversation: { userId } },
    select: { id: true, conversationId: true, createdAt: true },
  });
  if (!message) throw new AppError("NOT_FOUND", "ไม่พบข้อความผู้ใช้นี้");

  await prisma.$transaction([
    prisma.message.deleteMany({
      where: {
        conversationId: message.conversationId,
        createdAt: { gt: message.createdAt },
      },
    }),
    prisma.message.update({
      where: { id: message.id },
      data: { content: trimmed },
    }),
    prisma.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return { conversationId: message.conversationId, content: trimmed };
}

/**
 * Regenerate an assistant answer: remove it and everything after, return the
 * preceding user question for a fresh AI run.
 */
export async function prepareRegenerateAssistant(
  userId: string,
  assistantMessageId: string,
): Promise<{ conversationId: string; content: string }> {
  const assistant = await prisma.message.findFirst({
    where: {
      id: assistantMessageId,
      role: "ASSISTANT",
      conversation: { userId },
    },
    select: { id: true, conversationId: true, createdAt: true },
  });
  if (!assistant) throw new AppError("NOT_FOUND", "ไม่พบคำตอบนี้");

  const priorUser = await prisma.message.findFirst({
    where: {
      conversationId: assistant.conversationId,
      role: "USER",
      createdAt: { lt: assistant.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  if (!priorUser?.content.trim()) {
    throw new AppError("VALIDATION", "ไม่พบคำถามก่อนหน้าสำหรับสร้างคำตอบใหม่");
  }

  await prisma.message.deleteMany({
    where: {
      conversationId: assistant.conversationId,
      createdAt: { gte: assistant.createdAt },
    },
  });

  await prisma.conversation.update({
    where: { id: assistant.conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    conversationId: assistant.conversationId,
    content: priorUser.content.trim(),
  };
}

/** Persist only the user turn (before background AI). */
export async function appendUserMessage(input: {
  conversationId: string;
  userId: string;
  userContent: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    select: { id: true, title: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  const title = conversation.title?.trim() || truncateTitle(input.userContent);

  // Return the row id: the client shows an optimistic bubble with a local id,
  // and needs the real one before edit/regenerate can address this message.
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: input.userContent,
      },
      select: { id: true },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        ...(conversation.title ? {} : { title }),
      },
    }),
  ]);

  return message;
}

/** Placeholder assistant row while AI runs in `after()`. */
export async function createPendingAssistant(input: {
  conversationId: string;
  userId: string;
  idempotencyKey: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, userId: input.userId },
    select: { id: true },
  });
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found");

  return prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: "",
      idempotencyKey: input.idempotencyKey,
      status: "PENDING",
      creditCost: 0,
    },
  });
}

/** Fill in the pending assistant after AI succeeds or fails. */
export async function finalizeAssistantMessage(input: {
  conversationId: string;
  idempotencyKey: string;
  content: string;
  status: ReadingStatus;
  provider?: AIProvider;
  modelId?: string | null;
  creditCost?: number;
}) {
  await prisma.message.updateMany({
    where: {
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      role: "ASSISTANT",
    },
    data: {
      content: input.content,
      status: input.status,
      provider: input.provider,
      modelId: input.modelId ?? undefined,
      creditCost: input.creditCost ?? 0,
    },
  });
  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { updatedAt: new Date() },
  });
}

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

  const recent = await prisma.message.findMany({
    where: {
      conversationId,
      OR: [
        { role: "USER" },
        { role: "ASSISTANT", status: { not: "PENDING" }, NOT: { content: "" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_PRIOR_MESSAGES_LOAD,
    select: { role: true, content: true },
  });

  return recent.reverse();
}

/**
 * Fail assistant turns that have been PENDING far longer than a generation can
 * take. They are left behind when the serverless instance is torn down mid-AI,
 * and a row nobody will ever finalize renders as "generating" forever.
 *
 * The AI itself is capped at ~30s, so anything past two minutes is dead.
 */
export async function sweepStalePendingAssistants(conversationId: string) {
  await prisma.message.updateMany({
    where: {
      conversationId,
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
}
