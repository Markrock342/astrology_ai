import { describe, expect, it } from "vitest";
import {
  bangkokDateKey,
  resolveTimeKeyword,
  resolveTransitWindow,
} from "@/lib/reading-intent";

// Today is the starting point for every row in the client's table.
const TODAY = new Date("2026-09-21T10:00:00+07:00");

function dayOf(question: string): string | null {
  const hit = resolveTimeKeyword(question, TODAY);
  return hit ? bangkokDateKey(hit.at) : null;
}

describe("time keywords resolve to a day without asking", () => {
  const rows: Array<[string, string]> = [
    // Day
    ["ช่วงนี้การงานเป็นไง", "2026-09-21"],
    ["ตอนนี้ควรลงทุนไหม", "2026-09-21"],
    ["พรุ่งนี้ดวงเป็นยังไง", "2026-09-22"],
    ["มะรืนนี้เหมาะเดินทางไหม", "2026-09-23"],
    ["เมื่อวานนี้ดวงเป็นยังไง", "2026-09-20"],
    // Week
    ["สัปดาห์นี้การเงินเป็นไง", "2026-09-21"],
    ["อาทิตย์นี้ควรเริ่มงานใหม่ไหม", "2026-09-21"],
    ["สัปดาห์หน้าดวงการงานจะเป็นยังไง", "2026-09-28"],
    ["อาทิตย์หน้าเหมาะเซ็นสัญญาไหม", "2026-09-28"],
    ["สัปดาห์ที่แล้วเป็นยังไง", "2026-09-14"],
    // Month
    ["เดือนนี้การเงินเป็นไง", "2026-09-21"],
    ["เดือนหน้าจะได้ย้ายงานไหม", "2026-10-21"],
    ["เดือนที่แล้วเป็นยังไง", "2026-08-22"],
    ["อีก 2 เดือนจะดีขึ้นไหม", "2026-11-20"],
    ["อีก 2-3 เดือนงานจะเป็นยังไง", "2026-11-20"],
    ["ครึ่งปีนี้เป็นยังไง", "2027-03-20"],
    // Year
    ["ปีนี้ดวงเป็นยังไง", "2026-09-21"],
    ["ปีหน้าดวงการเงินจะเป็นอย่างไร", "2027-09-21"],
    ["ปีที่แล้วเป็นยังไง", "2025-09-21"],
    ["อีก 2-3 ปีจะมั่นคงไหม", "2028-09-20"],
  ];

  for (const [question, expected] of rows) {
    it(`"${question}" → ${expected}`, () => {
      expect(dayOf(question)).toBe(expected);
    });
  }

  it("leaves a question with no time phrase alone", () => {
    expect(dayOf("งานสายไหนเหมาะกับฉัน")).toBeNull();
  });

  it("feeds the resolved day into the transit window", () => {
    const window = resolveTransitWindow("เดือนหน้าจะได้ย้ายงานไหม", TODAY);
    expect(window.intent).toBe("transit");
    expect(bangkokDateKey(window.sampleAt)).toBe("2026-10-21");
  });

  it("still honours a day the user picked by hand", () => {
    const window = resolveTransitWindow(
      "เดือนหน้าจะได้ย้ายงานไหม",
      TODAY,
      "2026-12-01",
    );
    expect(bangkokDateKey(window.sampleAt)).toBe("2026-12-01");
  });
});
