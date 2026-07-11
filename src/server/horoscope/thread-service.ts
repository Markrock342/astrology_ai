import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

/** List transit (ดวงจร) conversation threads for the sidebar. */
export async function listTransitThreads(userId: string, limit = 50) {
  const rows = await prisma.conversation.findMany({
    where: { userId, mode: "TRANSIT" },
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

/** List natal (พื้นดวงเดิม) conversation threads for sidebar/history. */
export async function listNatalThreads(userId: string, limit = 50) {
  const rows = await prisma.conversation.findMany({
    where: {
      userId,
      mode: "NATAL",
      messages: { some: {} },
    },
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

  return rows.map((c) => {
    const firstQuestion = c.messages[0]?.content;
    const fallbackTitle = firstQuestion
      ? firstQuestion.length > 48
        ? `${firstQuestion.slice(0, 48)}…`
        : firstQuestion
      : c.category.nameTh;
    return {
      id: c.id,
      title: c.title?.trim() || fallbackTitle,
      categorySlug: c.category.slug,
      categoryLabel: c.category.nameTh,
      createdAt: c.updatedAt.toISOString(),
    };
  });
}

/** @deprecated Use listNatalThreads — kept for legacy reading rows during migration. */
export async function listUserThreads(userId: string, limit = 50) {
  return listNatalThreads(userId, limit);
}

/** Restore a past thread as user + assistant messages. */
export async function getThreadDetail(userId: string, threadId: string) {
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
    return {
      id: conversation.id,
      categorySlug: conversation.category.slug,
      categoryLabel: conversation.category.nameTh,
      mode: conversation.mode,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
        modelId: m.modelId ?? undefined,
      })),
    };
  }

  // Legacy: single-turn reading before Conversation model.
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
  if (!reading || !reading.responseText) {
    throw new AppError("NOT_FOUND", "ไม่พบประวัติการสนทนานี้");
  }

  return {
    id: reading.id,
    categorySlug: reading.category.slug,
    categoryLabel: reading.category.nameTh,
    mode: "NATAL" as const,
    messages: [
      {
        id: `${reading.id}-user`,
        role: "user" as const,
        content: reading.question,
      },
      {
        id: `${reading.id}-assistant`,
        role: "assistant" as const,
        content: reading.responseText,
        modelId: reading.modelId ?? undefined,
      },
    ],
  };
}
