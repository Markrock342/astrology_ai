import { describe, expect, it } from "vitest";
import { futureDatePromptEventBodySchema } from "@/lib/future-date-prompt-telemetry";
import { summarizeFutureDatePromptEvents } from "@/server/analytics/future-date-prompt-service";

describe("future-date prompt telemetry privacy", () => {
  it("accepts only a trigger and outcome", () => {
    expect(
      futureDatePromptEventBodySchema.parse({
        trigger: "month_next",
        action: "CONFIRMED",
      }),
    ).toEqual({ trigger: "month_next", action: "CONFIRMED" });
  });

  it("rejects question content and identifiers", () => {
    expect(() =>
      futureDatePromptEventBodySchema.parse({
        trigger: "month_next",
        action: "CANCELLED",
        question: "เดือนหน้าจะได้งานไหม",
      }),
    ).toThrow();
    expect(() =>
      futureDatePromptEventBodySchema.parse({
        trigger: "month_next",
        action: "CANCELLED",
        userId: "user-1",
      }),
    ).toThrow();
  });

  it("summarizes and ranks cancellation-heavy triggers", () => {
    const result = summarizeFutureDatePromptEvents([
      {
        trigger: "future_outcome",
        action: "CONFIRMED",
        _count: { _all: 2 },
      },
      {
        trigger: "future_outcome",
        action: "CANCELLED",
        _count: { _all: 8 },
      },
      {
        trigger: "month_next",
        action: "CONFIRMED",
        _count: { _all: 9 },
      },
      {
        trigger: "month_next",
        action: "CANCELLED",
        _count: { _all: 1 },
      },
    ]);

    expect(result[0]).toEqual({
      trigger: "future_outcome",
      confirmed: 2,
      cancelled: 8,
      total: 10,
      confirmationRate: 20,
    });
    expect(result[1]?.confirmationRate).toBe(90);
  });
});
