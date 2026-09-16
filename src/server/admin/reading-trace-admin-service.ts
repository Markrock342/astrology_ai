import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { checkAnswerAgainstTrace } from "@/lib/reading-trace-check";
import type { ReadingPromptTrace } from "@/types/reading-trace";

export type ListReadingsArgs = { page: number; pageSize: number; search?: string };

function asTrace(json: unknown): ReadingPromptTrace | null {
  if (!json || typeof json !== "object") return null;
  const t = json as Partial<ReadingPromptTrace>;
  return t.version === 1 && t.natal && t.window ? (t as ReadingPromptTrace) : null;
}

/** Readings newest first, with a one-line verdict per row. */
export async function listReadingTraces(args: ListReadingsArgs) {
  const where: Prisma.HoroscopeReadingWhereInput = {
    ...(args.search
      ? {
          OR: [
            { question: { contains: args.search, mode: "insensitive" } },
            { user: { email: { contains: args.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.horoscopeReading.count({ where }),
    prisma.horoscopeReading.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        id: true,
        question: true,
        responseText: true,
        modelId: true,
        status: true,
        createdAt: true,
        promptTraceJson: true,
        user: { select: { email: true, name: true } },
      },
    }),
  ]);
  const items = rows.map((row) => {
    const trace = asTrace(row.promptTraceJson);
    const check = trace ? checkAnswerAgainstTrace(row.responseText ?? "", trace) : null;
    return {
      id: row.id,
      question: row.question,
      modelId: row.modelId,
      status: row.status,
      createdAt: row.createdAt,
      user: row.user,
      hasTrace: Boolean(trace),
      intent: trace?.intent ?? null,
      windowLabel: trace?.window.label ?? null,
      pickedByUser: trace?.window.pickedByUser ?? false,
      knowledgeChunks: trace?.knowledge.chunks.length ?? 0,
      confirmed: check?.confirmed ?? 0,
      flagged: check?.flags.length ?? 0,
    };
  });
  return { total, page: args.page, pageSize: args.pageSize, items };
}

export async function getReadingTrace(id: string) {
  const row = await prisma.horoscopeReading.findUnique({
    where: { id },
    select: {
      id: true,
      question: true,
      responseText: true,
      modelId: true,
      provider: true,
      status: true,
      createdAt: true,
      promptTraceJson: true,
      user: { select: { email: true, name: true } },
      category: { select: { nameTh: true, slug: true } },
    },
  });
  if (!row) throw new AppError("NOT_FOUND", "ไม่พบการอ่านนี้");
  const trace = asTrace(row.promptTraceJson);
  return {
    id: row.id,
    question: row.question,
    answer: row.responseText,
    modelId: row.modelId,
    provider: row.provider,
    status: row.status,
    createdAt: row.createdAt,
    user: row.user,
    category: row.category,
    trace,
    check: trace ? checkAnswerAgainstTrace(row.responseText ?? "", trace) : null,
  };
}
