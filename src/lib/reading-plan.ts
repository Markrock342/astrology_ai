import {
  detectFutureDatePromptTrigger,
  detectReadingIntent,
  isDayPickQuestion,
  isCorrectionMessage,
  isFollowUpQuestion,
  isPastEventQuestion,
  isPinpointQuestion,
  isRelationshipQuestion,
  isTimelineQuestion,
  previousTimedQuestion,
  questionInContext,
  resolveMentionedDay,
  resolveTransitWindow,
  type TransitWindow,
} from "@/lib/reading-intent";
import { isContinueRequest } from "@/server/ai/prompt-builder";

/**
 * What a question will be read from — decided here, in one place, from its
 * words and the chat before it. It used to be spread through runReading, so
 * the routing could only be tested by running the model; the owner found a
 * past break-up dated to the future that way. Pure: no database, no model.
 */
export type ReadingPlan = {
  continuing: boolean;
  /** The question the time and topic are read from (may carry the one before). */
  intentQuestion: string;
  /** A day named by number in this question or the thread ("14 ผมมีนัด"). */
  mentionedDay: string | null;
  explicitDate: string | Date | null;
  transitWindow: TransitWindow;
  /** Answer first and short. */
  pinpoint: boolean;
  /** Walk the days of a period to pick from. */
  dayPick: boolean;
  /** One day to check against the week around it. */
  checkDay: string | Date | null;
  /** The question is about something that already happened. */
  pastEvent: boolean;
  /** The question a life timeline is built for, if any. */
  timelineQuestion: string | null;
  relationship: boolean;
  /** The user says the answer before was wrong. */
  correction: boolean;
  /**
   * พ.ศ. years given in answers the user then called wrong. A 24-year-old was
   * told the same break-up year again after "ผิดแล้ว เอาใหม่"; those years are
   * now taken out of what the model can pick from.
   */
  rejectedYears: number[];
  /** What the answer is read from, as shown above it. */
  basis: "timeline-past" | "timeline" | "day-scan" | "day-check" | "transit" | "natal";
};

export function planReading(input: {
  question: string;
  /** Oldest first, excluding this question. */
  priorMessages?: Array<{ role: "USER" | "ASSISTANT"; content: string }>;
  pickedDate?: string | Date | null;
  hasCompanions?: boolean;
  now?: Date;
}): ReadingPlan {
  const now = input.now ?? new Date();
  const question = input.question;
  const continuing = isContinueRequest(question);
  const newestFirst = [...(input.priorMessages ?? [])].reverse();
  const priorUser = newestFirst
    .filter((m) => m.role === "USER" && !isContinueRequest(m.content))
    .map((m) => m.content);
  const priorAssistant = newestFirst.filter((m) => m.role === "ASSISTANT").map((m) => m.content);

  // A day this question names is the whole of its time: "14 ผมมีนัด" after
  // "วันไหนจะมีคนจ้าง" is about the 14th, not another day-pick.
  const ownDay = continuing ? null : resolveMentionedDay(question, priorAssistant);
  const intentQuestion = continuing
    ? (priorUser[0] ?? question)
    : ownDay
      ? question
      : questionInContext(question, priorUser);
  // For "แล้วเรื่องเงินล่ะ": the day the thread is on.
  const timedBefore =
    !continuing && !ownDay && isFollowUpQuestion(question) ? previousTimedQuestion(question, priorUser) : null;
  const mentionedDay =
    ownDay ??
    (timedBefore && detectReadingIntent(question) === "natal"
      ? resolveMentionedDay(timedBefore, priorAssistant)
      : null);
  const explicitDate = input.pickedDate ?? mentionedDay;
  const transitWindow = resolveTransitWindow(intentQuestion, now, explicitDate ?? null);

  // Past or future, and about whom — from the words and the thread, not left
  // to the model's date arithmetic.
  const recentUser = priorUser.slice(0, 4);
  const pastEvent =
    !continuing &&
    (isPastEventQuestion(question) || (isFollowUpQuestion(question) && recentUser.some(isPastEventQuestion)));

  const pinpoint = !continuing && (isPinpointQuestion(intentQuestion) || Boolean(mentionedDay));
  // "ที่เราเคยเลิกกันวันไหน" asks when something happened, not for a good day ahead.
  const dayPick = !pastEvent && isDayPickQuestion(intentQuestion);
  const checkDay =
    explicitDate ??
    (detectFutureDatePromptTrigger(intentQuestion) === "explicit_date" ? transitWindow.sampleAt : null);
  const timelineQuestion = isTimelineQuestion(intentQuestion)
    ? intentQuestion
    : pastEvent
      ? (recentUser.find(isTimelineQuestion) ?? (isPastEventQuestion(question) ? question : null))
      : null;
  const relationship =
    isRelationshipQuestion(question) ||
    Boolean(input.hasCompanions) ||
    recentUser.slice(0, 2).some(isRelationshipQuestion);

  const correction = !continuing && isCorrectionMessage(question);
  const rejectedYears = new Set<number>();
  if (correction) {
    const thread = [...(input.priorMessages ?? []), { role: "USER" as const, content: question }];
    thread.forEach((m, i) => {
      if (m.role !== "ASSISTANT") return;
      const reply = thread.slice(i + 1).find((x) => x.role === "USER" && !isContinueRequest(x.content));
      if (!reply || !isCorrectionMessage(reply.content)) return;
      for (const y of m.content.match(/25\d\d/g) ?? []) rejectedYears.add(Number(y));
    });
  }

  const timeline = !dayPick && Boolean(timelineQuestion);
  const basis: ReadingPlan["basis"] = timeline
    ? pastEvent
      ? "timeline-past"
      : "timeline"
    : dayPick
      ? "day-scan"
      : checkDay && !continuing
        ? "day-check"
        : transitWindow.intent === "transit"
          ? "transit"
          : "natal";

  return {
    continuing,
    intentQuestion,
    mentionedDay,
    explicitDate,
    transitWindow,
    pinpoint,
    dayPick,
    checkDay,
    pastEvent,
    timelineQuestion: timeline ? timelineQuestion : null,
    relationship,
    correction,
    rejectedYears: [...rejectedYears].sort((a, b) => a - b),
    basis,
  };
}
