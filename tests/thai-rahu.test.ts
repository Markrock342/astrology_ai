import { describe, expect, it } from "vitest";
import { MakeTime } from "astronomy-engine";
import { thaiRahuSiderealLongitude } from "@/server/horoscope/engine/newhora/formulas/siderealPlanets";
import { basicStandardLabels, standardsText } from "@/lib/thai-dignity";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";

// Rahu as astro.meemodel.com (myhora's planets) printed it, Bangkok time.
// The mean node minus Lahiri was 25′ (1905) to 47′ (2038) ahead of these.
const MEEMODEL_RAHU: Array<[number, number, number, number, number, number]> = [
  [1905, 11, 20, 3, 46, 122.4],
  [1955, 1, 26, 2, 25, 250.32],
  [1972, 9, 17, 4, 31, 268.78],
  [1986, 7, 15, 15, 48, 1.17],
  [2003, 7, 1, 13, 47, 32.85],
  [2024, 7, 28, 15, 31, 344.87],
  [2038, 2, 19, 16, 17, 82.3],
];

describe("ราหูไทย", () => {
  it.each(MEEMODEL_RAHU)("matches myhora's Rahu on %i-%i-%i within 2′", (y, m, d, hh, mm, lon) => {
    const ut = MakeTime(new Date(Date.UTC(y, m - 1, d, hh - 7, mm))).ut;
    let diff = thaiRahuSiderealLongitude(ut) - lon;
    diff = ((((diff + 180) % 360) + 360) % 360) - 180;
    expect(Math.abs(diff) * 60).toBeLessThan(2);
  });
});

describe("มาตรฐานที่ดาวได้พร้อมกันหลายอย่าง", () => {
  it("keeps both basic standards, as myhora and meemodel print them", () => {
    expect(basicStandardLabels("พุธ", "กันย์")).toEqual(["อุจจ์", "เกษตร"]);
    expect(basicStandardLabels("พุธ", "มีน")).toEqual(["นิจ", "ประ"]);
    expect(standardsText("พุธ", "มีน")).toBe("นิจ ประ");
    expect(standardsText("อาทิตย์", "พฤษภ")).toBe("ปกติ");
    expect(standardsText("เกตุ", "เมษ")).toBe("—");
  });
});

describe("อังคาร follows its position, not the 100-year table", () => {
  // Days the table still had Mars in the previous sign; meemodel (myhora's planets) did not.
  it.each([
    [2033, 10, 2, "08:17", "มกร"],
    [2016, 12, 6, "13:19", "กุมภ์"],
    [1962, 12, 2, "13:12", "สิงห์"],
  ] as const)("%i-%i-%i %s → %s", (year, month, day, time, sign) => {
    const chart = computeNatalChartFormula({ day, month, year, time, country: "ไทย", province: "กรุงเทพมหานคร", district: "ป้อมปราบศัตรูพ่าย" });
    const mars = chart.planets.find((p) => p.planet === "อังคาร");
    expect(mars?.siderealSign).toBe(sign);
    expect(mars?.degreeInSign).toBeTypeOf("number");
  });
});
