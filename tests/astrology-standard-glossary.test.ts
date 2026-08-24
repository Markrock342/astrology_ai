import { describe, expect, it } from "vitest";
import { collectAstrologyStandards } from "@/lib/astrology-standard-glossary";

describe("astrology standard glossary", () => {
  it("collects only standards present in the user's MyHora rows", () => {
    const entries = collectAstrologyStandards([
      {
        planet: "๓.อังคาร",
        zodiac: "09 : มก",
        degree: "20",
        minute: "55 ส.",
        rerkStandard: "มหาอุจจ์",
      },
      {
        planet: "๔.พุธ",
        zodiac: "06 : ตล",
        degree: "26",
        minute: "44",
        rerkStandard: "อุจจาภิมุข ตนุลัคน์ ศูนย์พาหะ",
      },
    ]);

    expect(entries.map((entry) => entry.term)).toEqual([
      "มหาอุจจ์",
      "อุจจาภิมุข",
      "ตนุลัคน์",
      "ศูนย์พาหะ",
    ]);
    expect(entries[0]?.planets).toEqual(["อังคาร"]);
  });
});
