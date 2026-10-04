import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: { user: { findMany: mocks.findMany, update: mocks.update } } }));
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

  it("marks a sent week, and leaves a failed send to be tried again", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "ok", email: "a@x.co", name: null, natalChart: { chartJson: natal } },
      { id: "bad", email: "b@x.co", name: null, natalChart: { chartJson: natal } },
    ]);
    mocks.sendEmail.mockResolvedValueOnce({ ok: true, via: "dev" }).mockResolvedValueOnce({ ok: false, error: "x" });
    const r = await runWeeklyDaysEmails({ now: NOW });
    expect(r).toMatchObject({ candidates: 2, sent: 1, failed: 1 });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "ok" }, data: { weeklyDaysSentAt: NOW } });
  });

  it("asks only for opted-in, verified people not sent this week", async () => {
    mocks.findMany.mockResolvedValue([]);
    await runWeeklyDaysEmails({ now: NOW });
    const where = mocks.findMany.mock.calls[0]![0].where;
    expect(where.weeklyDaysEmail).toBe(true);
    expect(JSON.stringify(where.AND)).toContain("emailVerifiedAt");
  });
});
