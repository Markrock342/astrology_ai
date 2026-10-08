import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/db", () => ({ prisma: {} }));
import { summarizeCreditReport } from "@/server/admin/credit-report-service";

const bucket = (calls: number, inT: number, outT: number, usd: number) => ({ calls, inputTokens: inT, outputTokens: outT, cachedTokens: 0, costUsd: usd });

describe("summarizeCreditReport", () => {
  it("averages per answer, with and without background calls, and says what is left", () => {
    // 100 answers for $1.20, background $0.24, ฿400 topped up, ฿300 left.
    const s = summarizeCreditReport({ answers: bucket(100, 1_600_000, 90_000, 1.2), background: bucket(300, 300_000, 30_000, 0.24), topUpThb: 400, remainingThb: 300 });
    expect(s.perAnswer?.inputTokens).toBe(16_000);
    expect(s.perAnswer?.costThb).toBeCloseTo(0.432, 3);
    expect(s.perAnswer?.allInCostThb).toBeCloseTo(0.5184, 3);
    expect(s.perAnswer?.allInUnits).toBe(14_400);
    expect(s.answersLeft).toBe(578);
    expect(s.topUpUnits).toBe(11_111_111);
    expect(s.spentThb).toBeCloseTo(51.84, 2);
  });
  it("has no averages before any answer", () => {
    const s = summarizeCreditReport({ answers: bucket(0, 0, 0, 0), background: bucket(0, 0, 0, 0), topUpThb: null, remainingThb: null });
    expect(s.perAnswer).toBeNull();
    expect(s.answersLeft).toBeNull();
  });
});
