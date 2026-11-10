import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), generate: vi.fn(), config: vi.fn(), log: vi.fn(), sendEmail: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { user: { findUnique: mocks.findUnique, findMany: mocks.findMany, update: mocks.update, updateMany: mocks.updateMany } },
}));
vi.mock("@/server/email/mailer", () => ({ sendEmail: mocks.sendEmail }));

vi.mock("@/server/ai/router", () => ({ generateOnce: mocks.generate }));
vi.mock("@/server/horoscope/follow-up-suggestions", () => ({ resolveAuxConfig: mocks.config }));
vi.mock("@/server/ai/usage-logger", () => ({ logUsage: mocks.log }));

import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import {
  composeWeeklyDays, weeklyDates, weeklyFacts, weeklySummaryPrompt, parseWeeklyOverview, generateWeeklyOverview,
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
    mocks.findUnique.mockResolvedValue({ weeklyDaysEmail: true, status: "ACTIVE" });
    mocks.config.mockResolvedValue(null);
    mocks.log.mockResolvedValue({});
    process.env.AUTH_SECRET = "test-secret";
    mocks.sendEmail.mockResolvedValue({ ok: true, via: "dev" });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("lists the week's best days and how to stop it", () => {
    const mail = composeWeeklyDays(natal, NOW, "เอ", unsubscribeUrl("u1"))!;
    expect(mail.subject).toContain("[HORASARD] เช็กดวงรายสัปดาห์ของคุณ (วันอาทิตย์ที่ 4 ต.ค. 2569 - วันเสาร์ที่ 10 ต.ค. 2569)");
    expect(mail.text).toContain("สรุปจากผลคำนวณทั้ง 7 วัน");
    expect(mail.text).toMatch(/วัน\S+ที่ \d{1,2} ต\.ค\. 2569/);
    expect(mail.text).toContain("/api/notify/weekly-days/unsubscribe?u=u1&t=");
    expect(mail.html).not.toContain("<script");
  });


  it("normalizes Sunday–Saturday across month/year boundaries in Bangkok", () => {
    const days = weeklyDates(new Date("2026-12-31T20:00:00Z"));
    expect(days.map(d=>d.toISOString().slice(0,10))).toEqual(["2026-12-27","2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02"]);
    expect(weeklyDates(new Date("2026-11-07T17:00:00Z"))[0].toISOString()).toBe("2026-11-08T02:00:00.000Z");
  });

  it("gives AI seven computed days without identity, birth details or conversations", () => {
    const prompt = weeklySummaryPrompt(weeklyFacts(natal, NOW));
    const days=JSON.parse(prompt.userPrompt);
    expect(days).toHaveLength(7);
    expect(days[0].weekday).toBe("อาทิตย์");expect(days[6].weekday).toBe("เสาร์");
    expect(prompt.userPrompt).not.toContain("1992");
    expect(prompt.userPrompt).not.toContain("07:45");
    expect(prompt.timeoutMs).toBe(15000);
  });

  it("validates provider JSON and uses calculated fallback for bad output", async () => {
    expect(parseWeeklyOverview("not json")).toBeNull();
    expect(parseWeeklyOverview(JSON.stringify({overview:"<script>".repeat(20)}))).toBeNull();
    mocks.config.mockResolvedValue({id:"cfg"});
    mocks.generate.mockResolvedValue({ok:true,provider:"GEMINI",modelId:"test",latencyMs:1,rawText:"invalid"});
    expect(await generateWeeklyOverview(weeklyFacts(natal,NOW),"u1")).toBeNull();
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({userId:"u1",errorCode:"WEEKLY_EMAIL_SUMMARY"}));
  });

  it("sends an AI overview without consuming questions and escapes recipient HTML", async () => {
    const overview="สัปดาห์นี้ค่อย ๆ จัดลำดับงานและพักผ่อนให้เพียงพอ ใช้จังหวะที่ราบรื่นในการประสานงาน และตรวจรายละเอียดก่อนตัดสินใจ";
    mocks.config.mockResolvedValue({id:"cfg"});
    mocks.generate.mockResolvedValue({ok:true,provider:"GEMINI",modelId:"test",latencyMs:1,rawText:JSON.stringify({overview})});
    mocks.findMany.mockResolvedValue([{id:"u1",email:"a@x.co",name:'<img src=x onerror="x">',natalChart:{chartJson:natal}}]);
    expect(await runWeeklyDaysEmails({now:NOW})).toMatchObject({sent:1,failed:0});
    const message=mocks.sendEmail.mock.calls[0][0];
    expect(message.text).toContain(overview);
    expect(message.text).not.toContain("สรุปจากผลคำนวณทั้ง 7 วัน");
    // Only our own logo images; a name carrying <img> stays escaped text.
    expect([...message.html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1])).toEqual(["https://horasard.com/logo.png", "https://horasard.com/wordmark.png"]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("falls back after provider failure and still honours an opt-out before sending", async () => {
    mocks.config.mockResolvedValue({id:"cfg"});mocks.generate.mockRejectedValue(new Error("timeout"));
    mocks.findMany.mockResolvedValue([{id:"u1",email:"a@x.co",natalChart:{chartJson:natal}}]);
    expect(await runWeeklyDaysEmails({now:NOW})).toMatchObject({sent:1});
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain("สรุปจากผลคำนวณทั้ง 7 วัน");
    mocks.sendEmail.mockClear();mocks.findUnique.mockResolvedValue({weeklyDaysEmail:false,status:"ACTIVE"});
    expect(await runWeeklyDaysEmails({now:NOW})).toMatchObject({skipped:1,sent:0});
    expect(mocks.sendEmail).not.toHaveBeenCalled();
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
