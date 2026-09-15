import type { FutureDatePromptTrigger } from "@/lib/reading-intent";
import type { FutureDatePromptAction } from "@/lib/future-date-prompt-telemetry";
import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";

export type FutureDatePromptGroup = {
  trigger: string;
  action: string;
  _count: { _all: number };
};

export type FutureDatePromptBreakdown = {
  trigger: string;
  confirmed: number;
  cancelled: number;
  total: number;
  confirmationRate: number;
};

export function assertFutureDatePromptEventClient(): void {
  if (!prisma.futureDatePromptEvent) {
    throw new AppError(
      "INTERNAL",
      "Prisma client เก่า — รัน migration และ npx prisma generate แล้ว restart",
    );
  }
}

export async function recordFutureDatePromptEvent(input: {
  trigger: FutureDatePromptTrigger;
  action: FutureDatePromptAction;
}) {
  assertFutureDatePromptEventClient();
  await prisma.futureDatePromptEvent.create({
    data: { trigger: input.trigger, action: input.action },
    select: { id: true },
  });
  return { recorded: true };
}

export function summarizeFutureDatePromptEvents(
  groups: FutureDatePromptGroup[],
): FutureDatePromptBreakdown[] {
  const byTrigger = new Map<
    string,
    { confirmed: number; cancelled: number }
  >();
  for (const row of groups) {
    const bucket = byTrigger.get(row.trigger) ?? {
      confirmed: 0,
      cancelled: 0,
    };
    if (row.action === "CONFIRMED") bucket.confirmed += row._count._all;
    if (row.action === "CANCELLED") bucket.cancelled += row._count._all;
    byTrigger.set(row.trigger, bucket);
  }

  return [...byTrigger.entries()]
    .map(([trigger, counts]) => {
      const total = counts.confirmed + counts.cancelled;
      return {
        trigger,
        ...counts,
        total,
        confirmationRate: total > 0 ? (counts.confirmed / total) * 100 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.cancelled - a.cancelled ||
        b.total - a.total ||
        a.trigger.localeCompare(b.trigger),
    );
}
