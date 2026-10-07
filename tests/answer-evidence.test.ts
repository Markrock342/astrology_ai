import { describe, expect, it } from "vitest";
import { formatAnswerEvidence } from "@/lib/answer-evidence";
import { buildHouseChains } from "@/lib/house-chains";
import { linkTransitToNatal } from "@/lib/transit-to-natal";

const natalPlanets = [
  { planet: "อาทิตย์", siderealSign: "มีน" },
  { planet: "จันทร์", siderealSign: "พฤษภ" },
  { planet: "อังคาร", siderealSign: "กุมภ์" },
  { planet: "พุธ", siderealSign: "กุมภ" },
  { planet: "พฤหัสบดี", siderealSign: "กรกฎ" },
  { planet: "ศุกร์", siderealSign: "มกร" },
  { planet: "เสาร์", siderealSign: "ธนู" },
  { planet: "ราหู", siderealSign: "พิจิก" },
];

describe("formatAnswerEvidence", () => {
  const chains = buildHouseChains({ lagna: "เมษ", planets: natalPlanets as never });
  it("sets out the asked houses with lord, occupants and transits", () => {
    const links = linkTransitToNatal({
      natalLagna: "เมษ",
      natalPlanets: natalPlanets as never,
      transitPlanets: [{ planet: "เสาร์", siderealSign: "ตุลย์" }, { planet: "พฤหัสบดี", siderealSign: "มกร" }] as never,
    });
    const text = formatAnswerEvidence({ focusHouses: [7, 11], chains, lagna: "เมษ", natalPlanets, transitLinks: links }).join("\n");
    expect(text).toContain("ภพ 7 ปัตนิ");
    expect(text).toContain("เจ้าเรือนคือศุกร์");
    expect(text).toContain("เสาร์จรเดินเข้าภพนี้");
    // Planets in กุมภ์ (table spelling) count as inside ภพ 11.
    expect(text).toMatch(/ภพ 11[^\n]*ดาวเดิมในภพนี้: อังคาร พุธ/);
  });
  it("is empty with no focus or no lagna", () => {
    expect(formatAnswerEvidence({ focusHouses: [], chains, lagna: "เมษ", natalPlanets })).toEqual([]);
    expect(formatAnswerEvidence({ focusHouses: [7], chains, lagna: null, natalPlanets })).toEqual([]);
  });
});
