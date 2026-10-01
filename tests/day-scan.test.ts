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
