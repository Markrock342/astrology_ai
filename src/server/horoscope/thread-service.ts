import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

/** List past readings as chat threads for sidebar/history. */
export async function listUserThreads(userId: string, limit = 50) {
  const readings = await prisma.horoscopeReading.findMany({
    where: { userId, status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      question: true,
      createdAt: true,
      category: { select: { slug: true, nameTh: true } },
    },
  });

  return readings.map((r) => ({
    id: r.id,
    title:
      r.question.length > 48 ? `${r.question.slice(0, 48)}…` : r.question,
    categorySlug: r.category.slug,
    categoryLabel: r.category.nameTh,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Restore a past thread as user + assistant messages. */
export async function getThreadDetail(userId: string, threadId: string) {
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
