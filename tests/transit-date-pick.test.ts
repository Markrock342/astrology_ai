import { describe, expect, it } from "vitest";
import {
  formatTransitDateKey,
  parseTransitDateKey,
  parseTypedTransitDate,
  transitDateKeyFromPreset,
} from "@/lib/transit-date-pick";

const NOW = new Date("2026-09-08T05:17:00.000Z"); // 12:17 ICT

describe("transitDateKeyFromPreset", () => {
  it("anchors presets to Bangkok civil days", () => {
    expect(transitDateKeyFromPreset("today", NOW)).toBe("2026-09-08");
    expect(transitDateKeyFromPreset("tomorrow", NOW)).toBe("2026-09-09");
    expect(transitDateKeyFromPreset("plus1m", NOW)).toBe("2026-10-08");
    expect(transitDateKeyFromPreset("plus3m", NOW)).toBe("2026-12-08");
  });
});

describe("parseTypedTransitDate", () => {
  it("accepts slash dates in พ.ศ. and ค.ศ.", () => {
    expect(parseTypedTransitDate("15/10/2569", NOW)).toBe("2026-10-15");
    expect(parseTypedTransitDate("8/9/2026", NOW)).toBe("2026-09-08");
    expect(parseTypedTransitDate("๐๘/๐๙/๒๕๖๙", NOW)).toBe("2026-09-08");
  });

  it("accepts a Thai month phrase", () => {
    expect(parseTypedTransitDate("15 ต.ค. 2569", NOW)).toBe("2026-10-15");
    expect(parseTypedTransitDate("3 ก.ย.", NOW)).toBe("2026-09-03");
  });

  it("clamps 31 April and rejects junk", () => {
    expect(formatTransitDateKey(2026, 4, 31)).toBe("2026-04-30");
    expect(parseTransitDateKey("2026-09-08")).toEqual({
      year: 2026,
      month: 9,
      day: 8,
    });
    expect(parseTypedTransitDate("ไม่มีวัน", NOW)).toBeNull();
  });
});
