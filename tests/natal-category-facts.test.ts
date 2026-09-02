import { describe, expect, it } from "vitest";
import {
  askPromptForNatalCategory,
  natalBriefForCategory,
  natalFactsForCategory,
  NATAL_FACT_HOUSES,
} from "@/lib/natal-category-facts";
import type { ChartJson } from "@/types/chart";

const chart = {
  input: {
    day: 15,
    month: 1,
    year: 1990,
    time: "08:30",
    country: "ไทย",
    province: "กรุงเทพมหานคร",
    district: "พระนคร",
  },
  calculatedAt: new Date().toISOString(),
  settings: {
    calendar: "suryayat",
    ayanamsa: "lahiri",
    timeMethod: "antonathi_samrap_sunrise_local",
    rahuRule: "eight_signs_aquarius",
    taksaRahuLord: "mercury_night",
    taksaCountFrom: "center",
  },
  meta: {
    birthDisplay: "15/01/1990 08:30",
    locationDisplay: "พระนคร",
    calculationSource: "formula-pipeline",
    lagna: "เมษ",
  },
  planets: [
    { planet: "อาทิตย์", siderealSign: "มกร" },
    { planet: "จันทร์", siderealSign: "สิงห์" },
    { planet: "อังคาร", siderealSign: "พิจิก" },
    { planet: "พุธ", siderealSign: "ธนู" },
    { planet: "พฤหัสบดี", siderealSign: "มิถุน" },
    { planet: "ศุกร์", siderealSign: "มกร" },
    { planet: "เสาร์", siderealSign: "ธนู" },
    { planet: "ราหู", siderealSign: "มกร" },
    { planet: "เกตุ", siderealSign: "สิงห์" },
    { planet: "มฤตยู", siderealSign: "ธนู" },
  ],
  chart: {
    lagna: "เมษ",
    taksa: [],
  },
} as ChartJson;

describe("natalFactsForCategory", () => {
  it("keeps the same career houses as chart memory", () => {
    expect(NATAL_FACT_HOUSES.career).toEqual([10, 6, 2]);
    const facts = natalFactsForCategory(chart, "career");
    expect(facts.houses).toEqual([10, 6, 2]);
    expect(facts.lines[0]).toContain("กัมมะ");
    expect(facts.lines.some((line) => line.includes("เจ้าเรือน"))).toBe(true);
  });

  it("names lagna and birth for the self category", () => {
    const facts = natalFactsForCategory(chart, "self");
    expect(facts.lines[0]).toBe("ลัคนาเมษ");
    expect(facts.lines).toContain("15/01/1990 08:30");
  });

  it("builds a short ask prompt from the category label", () => {
    expect(askPromptForNatalCategory("การงาน")).toBe("ขอสรุปพื้นดวงหมวดการงาน");
  });

  it("explains finance houses and this chart's lords", () => {
    const brief = natalBriefForCategory(chart, "finance");
    expect(brief.meaning).toContain("ทรัพย์สิน");
    expect(brief.houses.map((house) => house.house)).toEqual([2, 11]);
    expect(brief.houses[0]?.name).toBe("กดุมภะ");
    expect(brief.houses[0]?.sign).toBe("พฤษภ");
    expect(brief.houses[0]?.lord).toBe("ศุกร์");
    expect(brief.lagna).toBe("เมษ");
  });
});
