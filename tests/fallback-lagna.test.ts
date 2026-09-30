import { describe, expect, it } from "vitest";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { computeFullChartSync } from "@/server/horoscope/engine/newhora/formulas/pipeline";
import { FORMULA_LAGNA_METHOD } from "@/types/chart";
import { MakeTime } from "astronomy-engine";
import { computeSiderealPlanets } from "@/server/horoscope/engine/newhora/formulas/siderealPlanets";
import { suriyayatSunLongitude } from "@/server/horoscope/engine/newhora/formulas/antonathiSamrap";

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
    // มิถุน rises in 72 minutes in the antonathi table, so 16:00 is already กรกฎ.
    expect(lagnaAt("16:00")).toBe("กรกฎ");
    expect(lagnaAt("18:00")).toBe("สิงห์");
  });
});

// Charts myhora itself produced, at the coordinates myhora used. The two
// methods this engine had before missed by 5–16° and got signs wrong.
// Degrees come from onehora's copies of live myhora charts.
describe("local lagna against myhora", () => {
  const place = (lat: number, lon: number) => ({ lat, lon, utcOffsetMinutes: 420 });
  it.each([
    ["1980-10-20 22:15", { year: 1980, month: 10, day: 20, time: "22:15" }, place(13.758, 100.514), "มิถุน", 19.77],
    ["1992-09-18 07:23", { year: 1992, month: 9, day: 18, time: "07:23" }, place(17.88, 102.742), "กันย์", 16.42],
    ["1963-04-23 09:15", { year: 1963, month: 4, day: 23, time: "09:15" }, place(13.853, 99.41), "มิถุน", 4.17],
  ])("%s rises in %s", (_label, birth, at, lagna, degree) => {
    const chart = computeFullChartSync(birth as never, at as never);
    expect(chart.lagna).toBe(lagna);
    expect(Math.abs((chart.lagnaDegreeInSign ?? 99) - degree)).toBeLessThan(0.5);
  });

  it("puts a birth before dawn on the previous sunrise's day", () => {
    // myhora: กันย์ 12°55'.
    const chart = computeFullChartSync(
      { year: 2001, month: 11, day: 18, time: "02:08" } as never,
      place(13.752555, 100.494066) as never,
    );
    expect(chart.lagna).toBe("กันย์");
    expect(Math.abs((chart.lagnaDegreeInSign ?? 99) - 12.92)).toBeLessThan(0.5);
  });

  it("moves our Lahiri Sun onto myhora's", () => {
    // 18 Nov 2001 02:08 — myhora and astro.meemodel.com: พิจิก 1°08'.
    const t = MakeTime(new Date(Date.UTC(2001, 10, 17, 19, 8)));
    const lahiri = computeSiderealPlanets(t).get("อาทิตย์")!.siderealLongitude;
    expect(Math.abs(suriyayatSunLongitude(lahiri, t.ut) - (210 + 1 + 8 / 60))).toBeLessThan(0.05);
  });

  it("marks charts made with this method", () => {
    const chart = computeNatalChartFormula({
      day: 18, month: 11, year: 2001, time: "02:08", country: "ไทย",
      province: "นครราชสีมา", district: "โชคชัย",
    });
    expect(chart.chart?.lagna).toBe("กันย์");
    expect(chart.meta.formulaLagna).toBe(FORMULA_LAGNA_METHOD);
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
