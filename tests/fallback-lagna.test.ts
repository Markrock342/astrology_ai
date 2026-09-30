import { describe, expect, it } from "vitest";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";

// A day the 100-year table has planets for but no lagna. The fallback used to
// return 'เมษ' for every hour of it.
const day = {
  day: 1,
  month: 2,
  year: 1976,
  country: "ไทย",
  province: "กรุงเทพมหานคร",
  district: "ป้อมปราบศัตรูพ่าย",
};

const lagnaAt = (time: string) => {
  const chart = computeNatalChartFormula({ ...day, time });
  return chart.chart?.lagna ?? chart.meta.lagna;
};

describe("local fallback lagna", () => {
  it("moves with the birth time instead of sitting on Aries", () => {
    const seen = new Set(["06:00", "10:00", "14:00", "18:00", "22:00"].map(lagnaAt));
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("rises in the Sun's sign at sunrise and advances through the day", () => {
    // Sun is in มกร on 1 Feb 1976.
    expect(lagnaAt("07:00")).toBe("มกร");
    expect(lagnaAt("16:00")).toBe("มิถุน");
    expect(lagnaAt("18:00")).toBe("กรกฎ");
  });
});

// Charts myhora itself produced. The antonathi walk this engine used before
// put the first two in สิงห์ — a sign early.
describe("local lagna against myhora", () => {
  it.each([
    [{ day: 18, month: 11, year: 2001, time: "02:08", province: "นครราชสีมา", district: "โชคชัย" }, "กันย์"],
    [{ day: 21, month: 11, year: 2001, time: "02:00", province: "กรุงเทพมหานคร", district: "บางแค" }, "กันย์"],
    [{ day: 21, month: 5, year: 2006, time: "18:31", province: "กรุงเทพมหานคร", district: "พระนคร" }, "พิจิก"],
  ])("%o rises in %s", (birth, lagna) => {
    const chart = computeNatalChartFormula({ ...birth, country: "ไทย" });
    expect(chart.chart?.lagna).toBe(lagna);
    expect(chart.meta.formulaLagna).toBe("sidereal-ascendant");
  });
});

describe("formula Rahu", () => {
  it("is the mean node, not shifted by the lagna", () => {
    // Outside the 100-year table, so the formula alone decides.
    const at = (time: string) =>
      computeNatalChartFormula({
        day: 15, month: 6, year: 1938, time, country: "ไทย",
        province: "กรุงเทพมหานคร", district: "พระนคร",
      }).planets.find((p) => p.planet === "ราหู")?.siderealSign;
    expect(new Set(["06:00", "12:00", "18:00"].map(at))).toEqual(new Set(["พิจิก"]));
  });
});
