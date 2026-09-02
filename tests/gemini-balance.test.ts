import { describe, expect, it } from "vitest";
import { thbToUsd, usdToThb } from "@/config/ai-pricing";
import {
  computeGeminiBalanceEstimate,
  computeTopUpProfit,
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
    expect(view.remainingThb).toBeNull();
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
    expect(view.remainingThb).toBe(usdToThb(37.5));
    expect(view.status).toBe("ok");
    expect(view.note).toBe("top-up");
  });

  it("tracks a 400 baht Gemini top-up in THB", () => {
    const view = computeGeminiBalanceEstimate({
      snapshot: {
        balanceUsd: thbToUsd(400),
        recordedAt: "2026-09-01T00:00:00.000Z",
        lowThresholdUsd: thbToUsd(50),
        topUpThb: 400,
      },
      spendSinceUsd: thbToUsd(50),
      spendTodayUsd: thbToUsd(10),
      spendMonthUsd: thbToUsd(50),
      revenueSinceThb: 199,
      readingsSince: 40,
    });
    expect(view.topUpThb).toBe(400);
    expect(view.remainingThb).toBeCloseTo(350, 5);
    expect(view.spendSinceThb).toBeCloseTo(50, 5);
    expect(view.revenueSinceThb).toBe(199);
    expect(view.profitThb).toBeCloseTo(149, 5);
    expect(view.profitVsTopUpThb).toBe(-201);
    expect(view.breakEvenGapThb).toBe(201);
    expect(view.readingsSince).toBe(40);
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

describe("computeTopUpProfit", () => {
  it("shows operating profit as customer cash minus Gemini spend", () => {
    expect(
      computeTopUpProfit({
        topUpThb: 400,
        spendSinceThb: 50,
        revenueSinceThb: 199,
      }),
    ).toEqual({
      profitThb: 149,
      profitVsTopUpThb: -201,
      breakEvenGapThb: 201,
    });
  });

  it("marks the 400 baht round as paid off once cash-in covers it", () => {
    const paid = computeTopUpProfit({
      topUpThb: 400,
      spendSinceThb: 80,
      revenueSinceThb: 500,
    });
    expect(paid.profitThb).toBe(420);
    expect(paid.profitVsTopUpThb).toBe(100);
    expect(paid.breakEvenGapThb).toBe(0);
  });
});
