import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sweep: vi.fn(), weekly: vi.fn() }));
vi.mock("@/server/payment/slip-retention-service", () => ({ runSlipRetentionSweep: mocks.sweep }));
vi.mock("@/server/notify/weekly-days-service", () => ({ runWeeklyDaysEmails: mocks.weekly }));

// Coolify never read vercel.json: the PDPA slip sweep had stopped running.
describe("in-process scheduler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.sweep.mockResolvedValue({ scanned: 0, deleted: 0 });
    mocks.weekly.mockResolvedValue({ candidates: 1, sent: 1, skipped: 0, failed: 0 });
  });

  it("sweeps slips once a day and mails on Monday mornings (Bangkok)", async () => {
    const { runDueJobs } = await import("@/server/internal-scheduler");
    const monday8 = new Date("2026-10-05T01:00:00Z"); // Mon 08:00 Bangkok
    expect(await runDueJobs(monday8)).toHaveLength(2);
    // Fifteen minutes later: the sweep is not due again; the email job runs
    // (it skips anyone already mailed this week).
    await runDueJobs(new Date(monday8.getTime() + 15 * 60_000));
    expect(mocks.sweep).toHaveBeenCalledTimes(1);
    expect(mocks.weekly).toHaveBeenCalledTimes(2);
  });

  it("does not mail before 07:00 Monday or on other days", async () => {
    const { runDueJobs } = await import("@/server/internal-scheduler");
    await runDueJobs(new Date("2026-10-04T23:00:00Z")); // Mon 06:00 Bangkok
    await runDueJobs(new Date("2026-10-06T03:00:00Z")); // Tue 10:00 Bangkok
    expect(mocks.weekly).not.toHaveBeenCalled();
  });
});
