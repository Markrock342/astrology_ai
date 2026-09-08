import { describe, expect, it } from "vitest";
import type { PlanetSignRow } from "@/types/chart";
import {
  aspectKindFromHouse,
  computeChartAspects,
  formatAspectsForPrompt,
  houseFromSign,
  signWheelAngle,
  shortestDegreeSep,
} from "@/lib/chart-aspects";

function planet(name: string, sign: string, degreeInSign: number): PlanetSignRow {
  return { planet: name, siderealSign: sign, degreeInSign };
}

describe("Thai whole-sign aspects", () => {
  it("counts houses inclusively: same = 1, opposite = 7", () => {
    expect(houseFromSign("เมษ", "เมษ")).toBe(1);
    expect(houseFromSign("เมษ", "ตุลย์")).toBe(7);
    expect(houseFromSign("เมษ", "สิงห์")).toBe(5);
    expect(houseFromSign("เมษ", "ธนู")).toBe(9);
    expect(houseFromSign("เมษ", "กรกฎ")).toBe(4);
    expect(houseFromSign("เมษ", "มกร")).toBe(10);
  });

  it("maps those houses to กุม เล็ง ตรีโกณ จตุโกณ", () => {
    expect(aspectKindFromHouse(1)).toBe("กุม");
    expect(aspectKindFromHouse(7)).toBe("เล็ง");
    expect(aspectKindFromHouse(5)).toBe("ตรีโกณ");
    expect(aspectKindFromHouse(9)).toBe("ตรีโกณ");
    expect(aspectKindFromHouse(4)).toBe("จตุโกณ");
    expect(aspectKindFromHouse(10)).toBe("จตุโกณ");
    expect(aspectKindFromHouse(2)).toBeNull();
  });

  it("treats two planets in the same rasi as กุม within 30°", () => {
    const aspects = computeChartAspects([
      planet("อาทิตย์", "เมษ", 2),
      planet("พุธ", "เมษ", 28),
    ]);
    const gum = aspects.find((item) => item.kind === "กุม");
    expect(gum?.a.name).toBe("อาทิตย์");
    expect(gum?.b.name).toBe("พุธ");
    expect(gum?.degreeSep).toBeCloseTo(26, 5);
    expect(gum?.houseFromA).toBe(1);
  });

  it("treats opposite rasis as เล็ง at 180° of signs", () => {
    const aspects = computeChartAspects([
      planet("จันทร์", "เมษ", 10),
      planet("เสาร์", "ตุลย์", 10),
    ]);
    const opp = aspects.find((item) => item.kind === "เล็ง");
    expect(opp?.a.name).toBe("จันทร์");
    expect(opp?.b.name).toBe("เสาร์");
    expect(opp?.houseFromA).toBe(7);
    expect(opp?.degreeSep).toBeCloseTo(180, 5);
  });

  it("does not call adjacent signs กุม even if longitudes are 2° apart across the cusp", () => {
    const aspects = computeChartAspects([
      planet("ศุกร์", "เมษ", 29),
      planet("อังคาร", "พฤษภ", 1),
    ]);
    expect(aspects.some((item) => item.kind === "กุม")).toBe(false);
    expect(shortestDegreeSep(29, 31)).toBeCloseTo(2, 5);
  });

  it("includes ลัคนา so a planet in the lagna sign is กุมลัคนา", () => {
    const aspects = computeChartAspects([planet("เสาร์", "กรกฎ", 12)], "กรกฎ");
    expect(
      aspects.some(
        (item) =>
          item.kind === "กุม" &&
          item.a.name === "ลัคนา" &&
          item.b.name === "เสาร์",
      ),
    ).toBe(true);
  });

  it("uses the actual lagna degree when computing degree separation", () => {
    const mid = computeChartAspects([planet("เสาร์", "กรกฎ", 12)], "กรกฎ").find(
      (item) => item.kind === "กุม",
    );
    const cusp = computeChartAspects(
      [planet("เสาร์", "กรกฎ", 12)],
      "กรกฎ",
      29,
    ).find((item) => item.kind === "กุม");
    expect(mid?.degreeSep).toBeCloseTo(3, 5);
    expect(cusp?.degreeSep).toBeCloseTo(17, 5);
  });

  it("writes a prompt table the model must not invent from", () => {
    const text = formatAspectsForPrompt(
      computeChartAspects(
        [planet("พฤหัสบดี", "ธนู", 5), planet("ศุกร์", "เมษ", 5)],
        "เมษ",
      ),
    ).join("\n");
    expect(text).toContain("[aspects]");
    expect(text).toContain("ห้ามเดามุม");
    expect(text).toContain("ตรีโกณ");
    expect(text).toContain("กุม");
  });
});

describe("rasi wheel degree placement", () => {
  it("puts 0° Aries on the Pisces boundary and 30° on the Taurus boundary", () => {
    expect(signWheelAngle(0, 0)).toBe(15);
    expect(signWheelAngle(0, 15)).toBe(0);
    expect(signWheelAngle(0, 30)).toBe(-15);
    expect(signWheelAngle(1, 0)).toBe(-15);
  });
});

describe("aspect pairs for trine and square", () => {
  it("marks house 5/9 as ตรีโกณ and house 4/10 as จตุโกณ", () => {
    const aspects = computeChartAspects([
      planet("อาทิตย์", "เมษ", 10),
      planet("พฤหัสบดี", "สิงห์", 10),
      planet("เสาร์", "กรกฎ", 10),
    ]);
    expect(
      aspects.some(
        (item) =>
          item.kind === "ตรีโกณ" &&
          item.a.name === "อาทิตย์" &&
          item.b.name === "พฤหัสบดี" &&
          item.houseFromA === 5,
      ),
    ).toBe(true);
    expect(
      aspects.some(
        (item) =>
          item.kind === "จตุโกณ" &&
          item.a.name === "อาทิตย์" &&
          item.b.name === "เสาร์" &&
          item.houseFromA === 4,
      ),
    ).toBe(true);
  });
});
