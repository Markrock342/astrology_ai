import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  bangkokCivilDate,
  detectReadingIntent,
  resolveTransitWindow,
} from "@/lib/reading-intent";
import { bangkokDateKey } from "@/lib/reading-intent";

const NOW = new Date("2026-09-08T05:17:00.000Z"); // 12:17 ICT

describe("detectReadingIntent", () => {
  it("treats natal-structure questions as natal", () => {
    expect(detectReadingIntent("ในพื้นดวงเดิม การเงินเป็นยังไง")).toBe("natal");
    expect(detectReadingIntent("ลัคนาฉันบอกอะไร")).toBe("natal");
  });

  it("treats future / period questions as transit", () => {
    expect(detectReadingIntent("ช่วง 3 เดือนนี้การเงินเป็นยังไง")).toBe("transit");
    expect(detectReadingIntent("อนาคตงานจะไปได้ไหม")).toBe("transit");
    expect(detectReadingIntent("เดือนหน้ามีจังหวะไหม")).toBe("transit");
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
