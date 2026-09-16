import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  bangkokCivilDate,
  detectFutureDatePromptTrigger,
  detectReadingIntent,
  resolveTransitWindow,
  shouldPromptForFutureDate,
  suggestedFutureDateKey,
} from "@/lib/reading-intent";
import { bangkokDateKey } from "@/lib/reading-intent";

const NOW = new Date("2026-09-08T05:17:00.000Z"); // 12:17 ICT

describe("detectReadingIntent", () => {
  it("treats natal-structure questions as natal", () => {
    expect(detectReadingIntent("ในพื้นดวงเดิม การเงินเป็นยังไง")).toBe("natal");
    expect(detectReadingIntent("ลัคนาฉันบอกอะไร")).toBe("natal");
  });

  it("reads a question with no time cue from the natal chart", () => {
    expect(detectReadingIntent("จุดแข็งของฉันคืออะไร")).toBe("natal");
    expect(detectReadingIntent("การงานเหมาะกับสายไหน")).toBe("natal");
    expect(detectReadingIntent("นิสัยฉันเป็นยังไง")).toBe("natal");
  });

  it("treats future / period questions as transit", () => {
    expect(detectReadingIntent("ช่วง 3 เดือนนี้การเงินเป็นยังไง")).toBe("transit");
    expect(detectReadingIntent("อนาคตงานจะไปได้ไหม")).toBe("transit");
    expect(detectReadingIntent("เดือนหน้ามีจังหวะไหม")).toBe("transit");
  });
});

describe("future date confirmation", () => {
  it("prompts for explicit future wording and result questions", () => {
    expect(shouldPromptForFutureDate("เดือนหน้าการงานจะเป็นยังไง")).toBe(true);
    expect(shouldPromptForFutureDate("ฉันจะได้งานใหม่ไหม")).toBe(true);
    expect(shouldPromptForFutureDate("ความรักจะดีขึ้นเมื่อไหร่")).toBe(true);
    expect(shouldPromptForFutureDate("ดูดวงวันที่ 20/10/2569")).toBe(true);
  });

  it("classifies one anonymous trigger without retaining the question", () => {
    expect(detectFutureDatePromptTrigger("พรุ่งนี้งานเป็นยังไง")).toBe(
      "tomorrow",
    );
    expect(detectFutureDatePromptTrigger("ปีหน้าจะได้แต่งงานไหม")).toBe(
      "year_next",
    );
    expect(detectFutureDatePromptTrigger("ฉันจะได้งานใหม่ไหม")).toBe(
      "future_outcome",
    );
    expect(detectFutureDatePromptTrigger("พื้นดวงเหมาะกับงานอะไร")).toBeNull();
  });

  it("does not interrupt a plain natal question", () => {
    expect(shouldPromptForFutureDate("พื้นดวงเดิมเหมาะกับงานอะไร")).toBe(false);
    expect(shouldPromptForFutureDate("ลัคนาของฉันมีจุดแข็งอะไร")).toBe(false);
  });

  it("prompts for N-days-ahead wording without the word อีก", () => {
    expect(detectFutureDatePromptTrigger("สองวันข้างหน้าจะเป็นอย่างไร")).toBe(
      "relative_period",
    );
    expect(detectFutureDatePromptTrigger("2 วันข้างหน้า")).toBe("relative_period");
    expect(detectFutureDatePromptTrigger("3 วันถัดไปการงานเป็นไง")).toBe(
      "relative_period",
    );
    expect(detectFutureDatePromptTrigger("อีก ๕ วันมีข่าวดีไหม")).toBe(
      "relative_period",
    );
  });

  it("prefills the day the relative span points at", () => {
    expect(suggestedFutureDateKey("สองวันข้างหน้าจะเป็นอย่างไร", NOW)).toBe(
      "2026-09-10",
    );
    expect(suggestedFutureDateKey("อีก 2 วันข้างหน้าดวงการงาน", NOW)).toBe(
      "2026-09-10",
    );
    expect(suggestedFutureDateKey("อีก 2 สัปดาห์", NOW)).toBe("2026-09-22");
    expect(suggestedFutureDateKey("อีก ๕ วัน", NOW)).toBe("2026-09-13");
    const range = resolveTransitWindow("ช่วง 5 วันนี้การเงินเป็นไง", NOW);
    expect(bangkokDateKey(range.sampleAt)).toBe("2026-09-08");
    expect(range.horizonAt && bangkokDateKey(range.horizonAt)).toBe("2026-09-13");
  });

  it("prefills a date derived from relative Thai wording", () => {
    expect(suggestedFutureDateKey("พรุ่งนี้จะเป็นยังไง", NOW)).toBe("2026-09-09");
    expect(suggestedFutureDateKey("มะรืนการเงินเป็นยังไง", NOW)).toBe("2026-09-10");
    expect(suggestedFutureDateKey("เดือนหน้าการงาน", NOW)).toBe("2026-10-08");
    expect(suggestedFutureDateKey("ปีหน้าความรัก", NOW)).toBe("2027-09-08");
  });
});

describe("resolveTransitWindow", () => {
  it("maps 3 months to now plus a horizon chart date", () => {
    const w = resolveTransitWindow("ช่วง 3 เดือนนี้การเงิน", NOW);
    expect(w.intent).toBe("transit");
    expect(bangkokDateKey(w.sampleAt)).toBe("2026-09-08");
    expect(w.horizonAt && bangkokDateKey(w.horizonAt)).toBe("2026-12-08");
    expect(w.label).toContain("3 เดือน");
  });

  it("jumps เดือนหน้า to next calendar month", () => {
    const w = resolveTransitWindow("เดือนหน้างานเป็นไง", NOW);
    expect(bangkokDateKey(w.sampleAt)).toBe("2026-10-08");
    expect(w.horizonAt).toBeNull();
  });

  it("reads an explicit Thai date as the transit day", () => {
    const w = resolveTransitWindow("ดูดวงจร 15 ต.ค. 2569", NOW);
    expect(bangkokDateKey(w.sampleAt)).toBe("2026-10-15");
  });

  it("honors a picked วันจร over the phrase", () => {
    const picked = bangkokCivilDate(2026, 11, 1, "09:00");
    const w = resolveTransitWindow("ช่วงนี้การงาน", NOW, picked);
    expect(bangkokDateKey(w.sampleAt)).toBe("2026-11-01");
  });

  it("keeps natal questions on the birth chart, not a future day", () => {
    const w = resolveTransitWindow("พื้นดวงเดิมเรื่องรักเป็นยังไง", NOW);
    expect(w.intent).toBe("natal");
    expect(w.horizonAt).toBeNull();
  });

  it("adds calendar months without UTC day-slip", () => {
    expect(bangkokDateKey(addCalendarMonths(NOW, 3))).toBe("2026-12-08");
  });
});
