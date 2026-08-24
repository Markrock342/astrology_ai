import { prisma } from "@/server/db";
import { isCategoryIntroQuestion } from "@/lib/intake-survey";

const MEMORY_QUERY_LIMIT = 80;
const MEMORY_RECENT_LIMIT = 6;
const MEMORY_QUESTION_MAX_CHARS = 220;

export type UserAiMemory = {
  enabled: boolean;
  nickname: string | null;
  resetAt: string | null;
  commonTopics: Array<{ slug: string; label: string; count: number }>;
  recentQuestions: Array<{
    category: string;
    question: string;
    askedAt: string;
  }>;
};

function compactQuestion(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > MEMORY_QUESTION_MAX_CHARS
    ? `${normalized.slice(0, MEMORY_QUESTION_MAX_CHARS - 1)}…`
    : normalized;
}

/**
 * Load only user-authored facts from prior chats. Assistant replies are never
 * treated as memory, because an earlier model answer is not a user fact.
 */
export async function getUserAiMemory(
  userId: string,
  options?: { excludeQuestion?: string },
): Promise<UserAiMemory> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      aiMemoryEnabled: true,
      aiMemoryResetAt: true,
      birthProfile: { select: { nickname: true } },
    },
  });

  if (!user) {
    return {
      enabled: false,
      nickname: null,
      resetAt: null,
      commonTopics: [],
      recentQuestions: [],
    };
  }

  const base = {
    enabled: user.aiMemoryEnabled,
    nickname: user.birthProfile?.nickname?.trim() || null,
    resetAt: user.aiMemoryResetAt?.toISOString() ?? null,
  };
  if (!user.aiMemoryEnabled) {
    return { ...base, commonTopics: [], recentQuestions: [] };
  }

  const rows = await prisma.message.findMany({
    where: {
      role: "USER",
      deletedAt: null,
      ...(user.aiMemoryResetAt
        ? { createdAt: { gt: user.aiMemoryResetAt } }
        : {}),
      ...(options?.excludeQuestion?.trim()
        ? { content: { not: options.excludeQuestion.trim() } }
        : {}),
      conversation: { userId },
    },
    orderBy: { createdAt: "desc" },
    take: MEMORY_QUERY_LIMIT,
    select: {
      content: true,
      createdAt: true,
      conversation: {
        select: { category: { select: { slug: true, nameTh: true } } },
      },
    },
  });

  const useful = rows.filter(
    (row) => row.content.trim() && !isCategoryIntroQuestion(row.content),
  );
  const counts = new Map<string, { slug: string; label: string; count: number }>();
  for (const row of useful) {
    const category = row.conversation.category;
    const current = counts.get(category.slug);
    counts.set(category.slug, {
      slug: category.slug,
      label: category.nameTh,
      count: (current?.count ?? 0) + 1,
    });
  }

  const commonTopics = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"))
    .slice(0, 4);
  const seen = new Set<string>();
  const recentQuestions = useful.flatMap((row) => {
    const question = compactQuestion(row.content);
    const key = question.toLocaleLowerCase("th-TH");
    if (!question || seen.has(key) || seen.size >= MEMORY_RECENT_LIMIT) return [];
    seen.add(key);
    return [{
      category: row.conversation.category.nameTh,
      question,
      askedAt: row.createdAt.toISOString(),
    }];
  });

  return { ...base, commonTopics, recentQuestions };
}

export function formatUserAiMemoryForPrompt(memory: UserAiMemory): string | null {
  if (!memory.enabled) return null;
  if (!memory.nickname && memory.commonTopics.length === 0 && memory.recentQuestions.length === 0) {
    return null;
  }

  const lines = [
    "[user_context] ความจำกลางที่ผู้ใช้อนุญาตให้ใช้ข้ามบทสนทนา",
    memory.nickname ? `- ชื่อเล่นที่ใช้เรียก: ${memory.nickname}` : null,
    memory.commonTopics.length > 0
      ? `- หมวดที่ผู้ใช้ถามบ่อย: ${memory.commonTopics.map((item) => `${item.label} (${item.count})`).join(" · ")}`
      : null,
    ...memory.recentQuestions.map(
      (item) => `- เคยถามในหมวด${item.category}: ${item.question}`,
    ),
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

export async function setUserAiMemoryEnabled(userId: string, enabled: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: { aiMemoryEnabled: enabled },
  });
  return getUserAiMemory(userId);
}

export async function resetUserAiMemory(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { aiMemoryResetAt: new Date() },
  });
  return getUserAiMemory(userId);
}
