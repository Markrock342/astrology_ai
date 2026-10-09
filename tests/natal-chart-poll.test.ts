import { beforeEach, describe, expect, it, vi } from "vitest";

// Code review 2026-10-09: the app's status poll rebuilt the chart (myhora
// scrape + engine) every 3–5 s, forever, for a chart stuck at FAILED.
const mocks = vi.hoisted(() => ({
  natalFind: vi.fn(),
  profileFind: vi.fn(),
  rateLimit: vi.fn(async () => {}),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    natalChart: { findUnique: mocks.natalFind },
    birthProfile: { findUnique: mocks.profileFind },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/server/horoscope/chart-memory-service", () => ({ upsertChartMemory: vi.fn() }));
vi.mock("@/server/app/bootstrap-cache", () => ({ invalidateUserBootstrap: vi.fn() }));

import { pollNatalChartStatus } from "@/server/horoscope/natal-chart-service";

const now = Date.parse("2026-10-09T10:00:00Z");
const row = (status: string, ageMs: number) => ({ status, note: null, updatedAt: new Date(now - ageMs) });

describe("natal chart status poll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No birth profile: a rebuild attempt throws early, and we only care whether it was tried.
    mocks.profileFind.mockResolvedValue(null);
  });

  it("does not rebuild a chart that failed a moment ago", async () => {
    mocks.natalFind.mockResolvedValue(row("FAILED", 10_000));
    expect(await pollNatalChartStatus("u1", { now })).toEqual({ status: "FAILED", note: null });
    expect(mocks.profileFind).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("does not start a second build while one is running", async () => {
    mocks.natalFind.mockResolvedValue(row("PENDING", 20_000));
    await pollNatalChartStatus("u1", { now });
    expect(mocks.profileFind).not.toHaveBeenCalled();
  });

  it("the retry button rebuilds even right after a failure, under its own limit", async () => {
    mocks.natalFind.mockResolvedValue(row("FAILED", 10_000));
    await pollNatalChartStatus("u1", { now, retry: true });
    expect(mocks.rateLimit).toHaveBeenCalledWith("natal-status:u1", 5, 60_000);
    expect(mocks.profileFind).toHaveBeenCalled();
  });

  it("rebuilds an old failure or a stalled build", async () => {
    mocks.natalFind.mockResolvedValue(row("FAILED", 5 * 60_000));
    await pollNatalChartStatus("u1", { now });
    expect(mocks.profileFind).toHaveBeenCalledTimes(1);
    mocks.natalFind.mockResolvedValue(row("PENDING", 5 * 60_000));
    await pollNatalChartStatus("u1", { now });
    expect(mocks.profileFind).toHaveBeenCalledTimes(2);
  });
});
