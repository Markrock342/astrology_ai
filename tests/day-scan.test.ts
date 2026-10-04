import { describe, expect, it } from "vitest";
import { dayScanDates, isDayPickQuestion, isTimelineQuestion } from "@/lib/reading-intent";
import { formatDayScanForPrompt, scanDays, thaiDayLabel } from "@/lib/day-scan";

const NOW = new Date("2026-10-01T03:00:00Z"); // 1 ต.ค. 2569 10:00 Bangkok

describe("day-pick questions", () => {
  it.each([
    "เดือนหน้าวันไหนดีที่จะเซ็นสัญญางาน",
    "หาฤกษ์ไปสัมภาษณ์งานให้หน่อย",
    "ช่วงไหนในปีหน้าที่ควรเริ่มธุรกิจ",
    "เลือกวันย้ายบ้านให้หน่อย",
  ])("%s", (q) => expect(isDayPickQuestion(q)).toBe(true));

  it("leaves life-timing and plain questions alone", () => {
    expect(isDayPickQuestion("ชีวิตจะพลิกตอนไหน")).toBe(false);
    expect(isTimelineQuestion("ชีวิตจะพลิกตอนไหน")).toBe(true);
    expect(isDayPickQuestion("งานปีนี้เป็นยังไง")).toBe(false);
  });
});

describe("the days walked", () => {
  it("covers the whole of next month", () => {
    const { days } = dayScanDates("เดือนหน้าวันไหนดี", NOW);
    expect(thaiDayLabel(days[0]!)).toBe("1 พ.ย. 2569");
    expect(thaiDayLabel(days.at(-1)!)).toBe("30 พ.ย. 2569");
  });

  it("covers a whole year without cutting it", () => {
    const { days, truncated } = dayScanDates("ช่วงไหนในปีหน้าดี", NOW);
    expect(days).toHaveLength(365);
    expect(truncated).toBe(false);
  });

  it("starts at a pinned day", () => {
    const { days } = dayScanDates("วันไหนดี", NOW, "2026-12-20");
    expect(thaiDayLabel(days[0]!)).toBe("20 ธ.ค. 2569");
    expect(days).toHaveLength(60);
  });
});

describe("scanDays", () => {
  // Saturday-born: กาลกิณี falls on Wednesday (พุธ), ศรี on Friday (ศุกร์).
  const taksa = [
    { index: 0, taksa: "บริวาร", planet: "เสาร์", planetNum: 7 },
    { index: 1, taksa: "ศรี", planet: "ศุกร์", planetNum: 6 },
    { index: 2, taksa: "กาลกิณี", planet: "พุธ", planetNum: 4 },
  ];
  const { days } = dayScanDates("สัปดาห์นี้วันไหนดี", NOW);
  const scan = scanDays({
    natalLagna: "กันย์",
    natalPlanets: [{ planet: "พฤหัสบดี", siderealSign: "มิถุน" }],
    natalTaksa: taksa as never,
    topicHouses: [10],
    days,
    // Moon in มิถุน (house 10, on natal Jupiter) on the Friday only.
    positionsAt: (d) => [{ planet: "จันทร์", siderealSign: new Date(d.getTime() + 7 * 3_600_000).getUTCDay() === 5 ? "มิถุน" : "มีน" }],
  })!;

  it("ranks the person's ศรี day with the Moon on their 10th first", () => {
    expect(scan.best[0]!.weekday).toBe("ศุกร์");
    expect(scan.best[0]!.reasons).toEqual(
      expect.arrayContaining(["จันทร์จรเดินภพ 10 กัมมะ (ภพของเรื่องที่ถาม)", "จันทร์จรกุมพฤหัสบดีเดิม"]),
    );
  });

  it("never recommends their วันกาลกิณี and lists it to avoid", () => {
    expect(scan.best.some((d) => d.weekday === "พุธ")).toBe(false);
    expect(scan.avoid.some((d) => d.weekday === "พุธ")).toBe(true);
  });

  it("formats a block the answer must pick from", () => {
    const text = formatDayScanForPrompt(scan).join("\n");
    expect(text).toMatch(/^\[day_scan\]/);
    expect(text).toContain("วันกาลกิณีของเจ้าชะตา");
  });
});

describe("the owner's own wordings", () => {
  it.each([
    "จากนี้ไปวันไหนดวงจรดี",
    "ดวงผมมีเกณฑ์ได้คุยงานไหม",
    "มีเกณฑ์ได้เงินเข้ามาเมื่อไหร่",
    "ช่วงนี้มีเกณฑ์ได้เงินไหม",
    "เมื่อไหร่จะได้เงินก้อน",
    "ต่อจากนี้ดวงจรดีช่วงไหน",
    "จะได้คุยงานใหญ่เมื่อไหร่",
  ])("%s walks the coming days", (q) => expect(isDayPickQuestion(q)).toBe(true));

  it.each(["ชีวิตจะพลิกตอนไหน", "เมื่อไหร่จะแต่งงาน", "ดวงจะขึ้นตอนอายุเท่าไหร่"])(
    "%s stays a life timeline",
    (q) => expect(isDayPickQuestion(q)).toBe(false),
  );

  it("looks 60 days ahead when no period is named", () => {
    expect(dayScanDates("มีเกณฑ์ได้เงินไหม", NOW).days).toHaveLength(60);
  });
});

describe("เล่าต่อ", () => {
  it("is recognised as a request to continue", async () => {
    const { isContinueRequest } = await import("@/server/ai/prompt-builder");
    for (const q of ["เล่าต่อ", "เล่าต่อ ▸", "ต่อเลยครับ", " เล่าต่อหน่อย "]) expect(isContinueRequest(q)).toBe(true);
    for (const q of ["เล่าต่อเรื่องงาน", "จะดีวันไหน", "ต่อสัญญาดีไหม"]) expect(isContinueRequest(q)).toBe(false);
  });
});

// QA 2026-10-04 (chat BUG-3/4/5).
describe("periods the chat QA found misread", () => {
  it("walks three months for ช่วง 3 เดือนนี้, not the rest of this month", () => {
    const { days } = dayScanDates("ช่วง 3 เดือนนี้ ช่วงไหนดีเรื่องงาน", NOW);
    expect(thaiDayLabel(days[0]!)).toBe("1 ต.ค. 2569");
    expect(thaiDayLabel(days.at(-1)!)).toBe("31 ธ.ค. 2569");
  });

  it("reads อาทิตย์หน้า as next week", async () => {
    const { detectReadingIntent } = await import("@/lib/reading-intent");
    expect(detectReadingIntent("อาทิตย์หน้างานเป็นยังไง")).toBe("transit");
    expect(detectReadingIntent("อาทิตย์นี้การเงินเป็นยังไง")).toBe("transit");
  });

  it("reads วันที่ 15 เดือนหน้า as a day, not a 15-month window", async () => {
    const { monthSpanOf, resolveTransitWindow } = await import("@/lib/reading-intent");
    expect(monthSpanOf("วันที่ 15 เดือนหน้าดีไหม")).toBeNull();
    expect(monthSpanOf("วันที่ 3 เดือนหน้าดีไหม")).toBeNull();
    expect(monthSpanOf("อีก 6 เดือนเป็นยังไง")).toBe(6);
    expect(monthSpanOf("สามเดือนนี้")).toBe(3);
    expect(monthSpanOf("ช่วง ๓ เดือน")).toBe(3);
    const w = resolveTransitWindow("วันที่ 15 เดือนหน้าเซ็นสัญญาดีไหม", NOW, "2026-10-20");
    expect(w.horizonAt).toBeNull();
  });

  it("walks next year for a milestone asked inside it", () => {
    expect(isDayPickQuestion("ปีหน้าเดือนไหนเหมาะจะแต่งงาน")).toBe(true);
    expect(isDayPickQuestion("ช่วงไหนดีที่จะแต่งงานปีหน้า")).toBe(true);
    expect(dayScanDates("ปีหน้าเดือนไหนเหมาะจะแต่งงาน", NOW).days).toHaveLength(365);
    expect(isDayPickQuestion("จะได้แต่งงานตอนอายุเท่าไหร่")).toBe(false);
  });
});

// 2026-10-04 owner: "วันไหนในเดือนนี้ผมจะดวงดีสุด" got sections and a table
// instead of the date.
describe("pinpoint questions get the answer first", () => {
  it.each([
    "วันไหนในเดือนนี้ผมจะดวงดีสุด",
    "เดือนหน้ามีเกณฑ์ได้งานใหม่ไหมครับ",
    "ปีนี้จะได้เลื่อนตำแหน่งไหม",
    "เมื่อไหร่จะเจอเนื้อคู่",
    "งานไหนดีที่สุดสำหรับผม",
  ])("%s", async (q) => {
    const { isPinpointQuestion } = await import("@/lib/reading-intent");
    expect(isPinpointQuestion(q)).toBe(true);
  });

  it.each([
    "อธิบายละเอียดหน่อยว่าทำไมวันศุกร์ดี",
    "ดูดวงภาพรวมให้หน่อย",
    "การงานปีนี้เป็นยังไงบ้าง",
  ])("keeps the full answer for %s", async (q) => {
    const { isPinpointQuestion } = await import("@/lib/reading-intent");
    expect(isPinpointQuestion(q)).toBe(false);
  });
});

// 2026-10-04 owner: "14 ผมมีนัดคุยงานกับลูกค้าด้วยอะดิ", after an answer that
// warned about 14 ต.ค., got a birth-chart essay.
describe("a day named by its number in a follow-up", () => {
  it("takes the month from the answer before", async () => {
    const { resolveMentionedDay } = await import("@/lib/reading-intent");
    const prior = ["มีเกณฑ์ได้รับงานช่วง 9-13 ต.ค. 69 แต่ให้ระวังวันที่ 7 และ 14 ต.ค. ที่อาจล่าช้า"];
    expect(resolveMentionedDay("14 ผมมีนัดคุยงานกับลูกค้าด้วยอะดิ", prior, NOW)).toBe("2026-10-14");
    expect(resolveMentionedDay("วันที่ 3 ล่ะ", ["ช่วง 3 พ.ย. ดีครับ"], NOW)).toBe("2026-11-03");
  });

  it("falls back to the next such day", async () => {
    const { resolveMentionedDay } = await import("@/lib/reading-intent");
    expect(resolveMentionedDay("วันที่ 14 ผมมีนัดคุยงาน", [], NOW)).toBe("2026-10-14");
  });

  it("leaves counts, spans and full dates alone", async () => {
    const { resolveMentionedDay } = await import("@/lib/reading-intent");
    for (const q of ["3 เดือนนี้เป็นยังไง", "อีก 2 วันดีไหม", "14 ต.ค. ดีไหม", "ดวงความรักเป็นยังไง", "30 ปีแล้วยังโสด"]) {
      expect(resolveMentionedDay(q, ["14 ต.ค."], NOW)).toBeNull();
    }
  });

  it("answers about that day, short", async () => {
    const { isPinpointQuestion } = await import("@/lib/reading-intent");
    expect(isPinpointQuestion("14 ผมมีนัดคุยงานกับลูกค้าด้วยอะดิ")).toBe(true);
  });
});

describe("a follow-up keeps the time asked before", () => {
  it("reads แล้วเรื่องเงินล่ะ in the period of the question before", async () => {
    const { questionInContext, resolveTransitWindow } = await import("@/lib/reading-intent");
    const q = questionInContext("แล้วเรื่องเงินล่ะ", ["เดือนหน้าการงานเป็นยังไง"]);
    expect(resolveTransitWindow(q, NOW).label).toContain("เดือนหน้า");
  });

  it("leaves a birth-chart question as one", async () => {
    const { questionInContext } = await import("@/lib/reading-intent");
    expect(questionInContext("แล้วนิสัยผมล่ะ", ["เดือนหน้าการงานเป็นยังไง"])).toBe("แล้วนิสัยผมล่ะ");
  });
});
