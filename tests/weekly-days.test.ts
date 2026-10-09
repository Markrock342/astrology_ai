import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { user: { findMany: mocks.findMany, update: mocks.update, updateMany: mocks.updateMany } },
}));
vi.mock("@/server/email/mailer", () => ({ sendEmail: mocks.sendEmail }));

import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import {
  composeWeeklyDays,
  isValidUnsubscribe,
  runWeeklyDaysEmails,
  unsubscribeUrl,
} from "@/server/notify/weekly-days-service";

const natal = computeNatalChartFormula({
  day: 23, month: 9, year: 1992, time: "07:45", country: "ไทย", province: "กรุงเทพมหานคร", district: "บางรัก",
});
const NOW = new Date("2026-10-05T00:00:00Z"); // Monday 07:00 Bangkok

describe("weekly good-days email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret";
    mocks.sendEmail.mockResolvedValue({ ok: true, via: "dev" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lists the week's best days and how to stop it", () => {
    const mail = composeWeeklyDays(natal, NOW, "เอ", unsubscribeUrl("u1"))!;
    expect(mail.subject).toMatch(/^วันดีของคุณสัปดาห์นี้: วัน/);
    expect(mail.text).toContain("วันเด่นของคุณสัปดาห์นี้");
    expect(mail.text).toMatch(/วัน\S+ที่ \d{1,2} ต\.ค\. 2569/);
    expect(mail.text).toContain("/api/notify/weekly-days/unsubscribe?u=u1&t=");
    expect(mail.html).not.toContain("<script");
  });

  it("only honours its own unsubscribe links", () => {
    const t = new URL(unsubscribeUrl("u1")!).searchParams.get("t")!;
    expect(isValidUnsubscribe("u1", t)).toBe(true);
    expect(isValidUnsubscribe("u2", t)).toBe(false);
    expect(isValidUnsubscribe("u1", "forged")).toBe(false);
  });

  // Code review 2026-10-09: a failure was given back at once and retried on
  // every 15-minute run; now it waits about an hour.
  it("claims the week before sending, and retries a failed send in about an hour", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "ok", email: "a@x.co", name: null, natalChart: { chartJson: natal } },
      { id: "bad", email: "b@x.co", name: null, natalChart: { chartJson: natal } },
      { id: "taken", email: "c@x.co", name: null, natalChart: { chartJson: natal } },
    ]);
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }); // another instance got there first
    mocks.sendEmail.mockResolvedValueOnce({ ok: true, via: "dev" }).mockResolvedValueOnce({ ok: false, error: "x" });
    const r = await runWeeklyDaysEmails({ now: NOW });
    expect(r).toMatchObject({ candidates: 3, sent: 1, failed: 1, skipped: 1 });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    const retryAt = mocks.update.mock.calls[0]![0].data.weeklyDaysSentAt as Date;
    expect(mocks.update.mock.calls[0]![0].where).toEqual({ id: "bad" });
    // Eligible again when weeklyDaysSentAt < now − 5 days: one hour from now.
    expect(retryAt.getTime()).toBe(NOW.getTime() - 5 * 86_400_000 + 60 * 60_000);
  });

  it("marks someone with nothing to send as done for the week, and orders the batch", async () => {
    mocks.findMany.mockResolvedValue([{ id: "nochart", email: "d@x.co", name: null, natalChart: null }]);
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    const r = await runWeeklyDaysEmails({ now: NOW });
    expect(r).toMatchObject({ skipped: 1, sent: 0 });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0]![0].orderBy).toBeDefined();
  });

  it("carries one-click unsubscribe headers", () => {
    const mail = composeWeeklyDays(natal, NOW, null, "https://horasard.com/api/notify/weekly-days/unsubscribe?u=1&t=x");
    if (!mail) return; // a week with no good day sends nothing
    expect(mail.headers?.["List-Unsubscribe"]).toContain("unsubscribe?u=1");
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("asks only for opted-in, verified people not sent this week", async () => {
    mocks.findMany.mockResolvedValue([]);
    await runWeeklyDaysEmails({ now: NOW });
    const where = mocks.findMany.mock.calls[0]![0].where;
    expect(where.weeklyDaysEmail).toBe(true);
    expect(JSON.stringify(where.AND)).toContain("emailVerifiedAt");
  });
});
