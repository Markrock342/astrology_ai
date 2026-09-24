import { describe, expect, it } from "vitest";
import {
  formatTransitToNatalForPrompt,
  linkTransitToNatal,
} from "@/lib/transit-to-natal";

// Natal: lagna เมษ, Venus in มีน, Sun in กันย์.
const natal = {
  natalLagna: "เมษ",
  natalPlanets: [
    { planet: "ศุกร์", siderealSign: "มีน" },
    { planet: "อาทิตย์", siderealSign: "กันย์" },
  ],
};

describe("where the moving planets land in this chart", () => {
  const links = linkTransitToNatal({
    ...natal,
    transitPlanets: [
      { planet: "จันทร์", siderealSign: "ตุลย์" },
      { planet: "เสาร์", siderealSign: "มีน" },
    ],
  });

  it("counts the transit house from the NATAL lagna", () => {
    const saturn = links.find((l) => l.transitPlanet === "เสาร์")!;
    // มีน is the 12th sign from เมษ.
    expect(saturn.natalHouse).toBe(12);
    expect(saturn.natalHouseName).toBe("วินาศ");
  });

  it("finds the natal planets a transit sits on or faces", () => {
    const saturn = links.find((l) => l.transitPlanet === "เสาร์")!;
    expect(saturn.contacts).toEqual(
      expect.arrayContaining([
        { kind: "กุม", natalBody: "ศุกร์" },
        { kind: "เล็ง", natalBody: "อาทิตย์" },
      ]),
    );
    // เมษ is the 2nd from มีน — no aspect to the lagna.
    expect(saturn.contacts.some((c) => c.natalBody === "ลัคนา")).toBe(false);
  });

  it("puts slow planets first, because they define a period", () => {
    expect(links[0]?.transitPlanet).toBe("เสาร์");
    expect(links.at(-1)?.transitPlanet).toBe("จันทร์");
  });

  it("writes a block the model cannot mistake for transit alone", () => {
    const text = formatTransitToNatalForPrompt(links).join("\n");
    expect(text).toContain("[transit_to_natal]");
    expect(text).toContain("เสาร์จร ราศีมีน · เดินในเรือน 12 วินาศ ของพื้นดวง");
    expect(text).toContain("กุมศุกร์เดิม");
    expect(text).toContain("เล็งอาทิตย์เดิม");
  });

  it("still links planets when the natal lagna is unknown", () => {
    const noLagna = linkTransitToNatal({
      natalLagna: null,
      natalPlanets: natal.natalPlanets,
      transitPlanets: [{ planet: "เสาร์", siderealSign: "มีน" }],
    });
    expect(noLagna[0]?.natalHouse).toBe(0);
    expect(noLagna[0]?.contacts).toContainEqual({ kind: "กุม", natalBody: "ศุกร์" });
  });
});
