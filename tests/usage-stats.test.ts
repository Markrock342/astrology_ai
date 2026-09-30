import { describe, expect, it } from "vitest";
import { bangkokHourLabel, computeUsageStats, spread } from "@/lib/usage-stats";

const at = (iso: string) => new Date(iso);
const call = (userId: string, iso: string, latencyMs = 10_000, firstTokenMs = 2_000) => ({
  userId,
  createdAt: at(iso),
  latencyMs,
  firstTokenMs,
});

describe("usage stats", () => {
  const calls = [
    // a: two sittings — three questions, then one after an hour's break
    call("a", "2026-09-30T12:00:00Z"),
    call("a", "2026-09-30T12:05:00Z"),
    call("a", "2026-09-30T12:20:00Z"),
    call("a", "2026-09-30T13:30:00Z"),
    // b: one question, overlapping a's first
    call("b", "2026-09-30T12:00:05Z", 20_000, 4_000),
  ];
  const s = computeUsageStats(calls, 1);

  it("counts questions per person", () => {
    expect(s.activeUsers).toBe(2);
    expect(s.perUser).toMatchObject({ avg: 2.5, max: 4 });
  });

  it("splits sittings on a 30-minute gap", () => {
    expect(s.sessions).toBe(3);
    expect(s.perSession).toMatchObject({ max: 3 });
    expect(s.sessionsPerUser).toBe(1.5);
  });

  it("finds the most answers written at once", () => {
    expect(s.load.peakConcurrent).toBe(2);
    expect(s.load.peakConcurrentAt).toBe("2026-09-30 19:00");
  });

  it("does not count back-to-back answers as overlapping", () => {
    const r = computeUsageStats(
      [call("a", "2026-09-30T12:00:00Z", 60_000), call("b", "2026-09-30T12:01:00Z")],
      1,
    );
    expect(r.load.peakConcurrent).toBe(1);
  });

  it("buckets by Bangkok hour", () => {
    expect(bangkokHourLabel(at("2026-09-30T17:30:00Z"))).toBe("2026-10-01 00:00");
    expect(s.load.busiestHour).toEqual({ at: "2026-09-30 19:00", calls: 4 });
    expect(s.load.byHourOfDay[19]).toBe(4);
    expect(s.load.byHourOfDay[20]).toBe(1);
  });

  it("reports response times", () => {
    expect(s.load.firstTokenMs.p95).toBe(4_000);
    expect(s.load.latencyMs.p50).toBe(10_000);
  });

  it("copes with no data", () => {
    const empty = computeUsageStats([], 30);
    expect(empty.activeUsers).toBe(0);
    expect(empty.load.peakConcurrentAt).toBeNull();
    expect(empty.load.latencyMs.p50).toBeNull();
    expect(spread([])).toEqual({ avg: 0, median: 0, p90: 0, max: 0 });
  });
});
