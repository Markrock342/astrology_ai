import type { FeedbackValue } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

/**
 * Thumbs up/down on an assistant answer.
 *
 * The buttons shipped writing to localStorage and nowhere else: a user could tell
 * us an answer was wrong and we would never find out. This is where that signal
 * lands now — the only direct read we have on answer quality.
 */

export type SubmitFeedbackInput = {
  userId: string;
  messageId: string;
  value: FeedbackValue;
  reason?: string;
};

const REASON_MAX = 500;

/** Prisma client must include MessageFeedback after migration + generate. */
export function assertFeedbackClient(): void {
  if (!prisma.messageFeedback) {
    throw new AppError(
      "INTERNAL",
      "Prisma client เก่า — รัน npx prisma generate แล้ว restart dev server",
    );
  }
}

export async function submitMessageFeedback(input: SubmitFeedbackInput) {
  assertFeedbackClient();
  // Only on YOUR OWN assistant answers, and not on a turn you have discarded.
  const message = await prisma.message.findFirst({
    where: {
      id: input.messageId,
      role: "ASSISTANT",
      deletedAt: null,
      conversation: { userId: input.userId },
    },
    select: { id: true },
  });
  if (!message) throw new AppError("NOT_FOUND", "ไม่พบคำตอบนี้");

  const reason = input.reason?.trim().slice(0, REASON_MAX) || null;

  // Voting again changes your mind; it does not stuff the ballot.
  const row = await prisma.messageFeedback.upsert({
    where: {
      messageId_userId: { messageId: message.id, userId: input.userId },
    },
    create: {
      messageId: message.id,
      userId: input.userId,
      value: input.value,
      reason,
    },
    update: { value: input.value, reason },
    select: { value: true, reason: true },
  });

  return { messageId: message.id, ...row };
}

/** Withdraw a verdict (tapping the same thumb again). */
export async function clearMessageFeedback(userId: string, messageId: string) {
  assertFeedbackClient();
  await prisma.messageFeedback.deleteMany({ where: { messageId, userId } });
  return { messageId, value: null };
}

export type FeedbackListItem = {
  id: string;
  value: FeedbackValue;
  reason: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
  message: {
    id: string;
    content: string;
    modelId: string | null;
    /** The question this answer was given to — a bad answer means nothing alone. */
    question: string | null;
  };
};

/**
 * Feedback for the admin, worst first.
 *
 * Ships the QUESTION alongside the answer: "this reply was bad" is unactionable
 * without knowing what was asked.
 */
export async function listFeedbackForAdmin(args: {
  value?: FeedbackValue;
  page: number;
  pageSize: number;
}) {
  assertFeedbackClient();
  // A verdict on an answer the user has since discarded (edited the question,
  // regenerated) is noise: they already told us it was wrong by replacing it,
  // and the answer is no longer in their thread to act on.
  const where = {
    message: { deletedAt: null },
    ...(args.value ? { value: args.value } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.messageFeedback.count({ where }),
    prisma.messageFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        id: true,
        value: true,
        reason: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
        message: {
          select: {
            id: true,
            content: true,
            modelId: true,
            conversationId: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  // The question is the USER row immediately before the answer.
  //
  // Deliberately NOT filtered by deletedAt: we want the question that PRODUCED
  // this answer, and an edit supersedes the original. Filtering it out made the
  // lookup skip past the real question and attach whatever older one survived —
  // showing the admin a thumbs-down next to a question that never got that reply.
  const questions = await Promise.all(
    rows.map((r) =>
      prisma.message.findFirst({
        where: {
          conversationId: r.message.conversationId,
          role: "USER",
          createdAt: { lt: r.message.createdAt },
        },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
    ),
  );

  const items: FeedbackListItem[] = rows.map((r, i) => ({
    id: r.id,
    value: r.value,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
    message: {
      id: r.message.id,
      content: r.message.content,
      modelId: r.message.modelId,
      question: questions[i]?.content ?? null,
    },
  }));

  // Same exclusion as the list, or the headline satisfaction number counts
  // verdicts on answers nobody can act on any more.
  const [up, down] = await Promise.all([
    prisma.messageFeedback.count({
      where: { value: "UP", message: { deletedAt: null } },
    }),
    prisma.messageFeedback.count({
      where: { value: "DOWN", message: { deletedAt: null } },
    }),
  ]);

  return {
    total,
    page: args.page,
    pageSize: args.pageSize,
    items,
    stats: {
      up,
      down,
      /** Share of verdicts that were positive. Null until somebody votes. */
      satisfactionPct: up + down > 0 ? (up / (up + down)) * 100 : null,
    },
  };
}
