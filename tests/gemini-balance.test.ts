import { describe, expect, it } from "vitest";
import {
  computeGeminiBalanceEstimate,
  DEFAULT_LOW_THRESHOLD_USD,
  AISTUDIO_BILLING_URL,
} from "@/server/admin/gemini-balance-service";

describe("computeGeminiBalanceEstimate", () => {
  it("is untracked when no snapshot exists", () => {
    const view = computeGeminiBalanceEstimate({
      snapshot: null,
      spendSinceUsd: 0,
      spendTodayUsd: 1.25,
      spendMonthUsd: 8,
    });
    expect(view.tracked).toBe(false);
    expect(view.status).toBe("untracked");
    expect(view.remainingUsd).toBeNull();
    expect(view.spendTodayUsd).toBe(1.25);
    expect(view.spendMonthUsd).toBe(8);
    expect(view.lowThresholdUsd).toBe(DEFAULT_LOW_THRESHOLD_USD);
    expect(view.aistudioBillingUrl).toBe(AISTUDIO_BILLING_URL);
  });

  it("subtracts spend since the snapshot", () => {
    const view = computeGeminiBalanceEstimate({
      snapshot: {
        balanceUsd: 50,
        recordedAt: "2026-07-01T00:00:00.000Z",
        lowThresholdUsd: 10,
        note: "top-up",
      },
      spendSinceUsd: 12.5,
      spendTodayUsd: 0.5,
      spendMonthUsd: 12.5,
    });
    expect(view.tracked).toBe(true);
    expect(view.remainingUsd).toBe(37.5);
    expect(view.status).toBe("ok");
    expect(view.note).toBe("top-up");
  });

  it("flags low and empty balances", () => {
    const low = computeGeminiBalanceEstimate({
      snapshot: {
        balanceUsd: 20,
        recordedAt: "2026-07-01T00:00:00.000Z",
        lowThresholdUsd: 10,
      },
      spendSinceUsd: 12,
      spendTodayUsd: 0,
      spendMonthUsd: 12,
    });
    expect(low.remainingUsd).toBe(8);
    expect(low.status).toBe("low");

    const empty = computeGeminiBalanceEstimate({
      snapshot: {
        balanceUsd: 5,
        recordedAt: "2026-07-01T00:00:00.000Z",
        lowThresholdUsd: 10,
      },
      spendSinceUsd: 9,
      spendTodayUsd: 0,
      spendMonthUsd: 9,
    });
    expect(empty.remainingUsd).toBe(0);
    expect(empty.status).toBe("empty");
  });

  it("clamps negative spend inputs", () => {
    const view = computeGeminiBalanceEstimate({
      snapshot: {
        balanceUsd: 10,
        recordedAt: "2026-07-01T00:00:00.000Z",
        lowThresholdUsd: 1,
      },
      spendSinceUsd: -3,
      spendTodayUsd: -1,
      spendMonthUsd: -2,
    });
    expect(view.spendSinceUsd).toBe(0);
    expect(view.remainingUsd).toBe(10);
    expect(view.status).toBe("ok");
  });
});
