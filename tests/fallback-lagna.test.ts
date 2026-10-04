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

// Charts myhora itself produced ("สุริยยาตร์, ลัคนาอันโตนาทีสามัญ สมผุสอาทิตย์
// อุทัย ปรับเวลาท้องถิ่น"), captured by the owner at the coordinates myhora
// printed. Degree where myhora showed it (±0.15°), otherwise the navamsa it
// named (a 3°20' band). Earlier methods missed by 3–16° and got signs wrong.
describe("local lagna against myhora", () => {
  const place = (lat: number, lon: number) => ({ lat, lon, utcOffsetMinutes: 420 });
  it.each([
    ["2001-11-18 02:08 กรุงเทพฯ", 2001, 11, 18, "02:08", 13.752555, 100.494066, "กันย์", 12.92, 12.92],
    ["1987-01-05 04:30 กรุงเทพฯ", 1987, 1, 5, "04:30", 13.752555, 100.494066, "พิจิก", 15.25, 15.25],
    ["1992-06-20 03:15 กรุงเทพฯ", 1992, 6, 20, "03:15", 13.752555, 100.494066, "เมษ", 13.42, 13.42],
    ["2001-11-18 02:08 โชคชัย", 2001, 11, 18, "02:08", 14.7317, 102.163, "กันย์", 13.33, 16.67],
    ["1997-03-10 01:20 อุบลฯ", 1997, 3, 10, "01:20", 15.2283, 104.855, "พิจิก", 23.33, 26.67],
    ["1985-08-25 05:40 กาญจนบุรี", 1985, 8, 25, "05:40", 14.0033, 99.55, "กรกฎ", 23.33, 26.67],
    ["2005-12-15 06:40 เชียงใหม่", 2005, 12, 15, "06:40", 18.79, 98.9867, "พิจิก", 20, 23.33],
    ["2002-06-19 22:43 สว่างแดนดิน", 2002, 6, 19, "22:43", 17.475, 103.458, "กุมภ", 6.67, 10],
    ["1995-02-12 09:00 อุบลฯ", 1995, 2, 12, "09:00", 15.2283, 104.855, "มีน", 13.48, 13.48],
    ["1998-07-03 13:00 เชียงใหม่", 1998, 7, 3, "13:00", 18.79, 98.9867, "กันย์", 19.63, 19.63],
    ["1987-10-21 10:30 นราธิวาส", 1987, 10, 21, "10:30", 6.42667, 101.825, "พิจิก", 22.32, 22.32],
    ["2007-05-08 15:45 แม่สอด", 2007, 5, 8, "15:45", 16.7133, 98.575, "กันย์", 18.4, 18.4],
    ["1992-12-30 07:30 นครพนม", 1992, 12, 30, "07:30", 17.41, 104.778, "ธนู", 29.27, 29.27],
    ["1982-08-17 11:15 ภูเก็ต", 1982, 8, 17, "11:15", 7.89, 98.385, "กันย์", 22.37, 22.37],
    ["2002-04-05 19:20 อุบลฯ", 2002, 4, 5, "19:20", 15.2283, 104.855, "ตุลย์", 9.32, 9.32],
    ["1990-01-25 20:10 แม่ฮ่องสอน", 1990, 1, 25, "20:10", 19.3033, 97.9767, "สิงห์", 18.58, 18.58],
  ] as const)("%s", (_label, year, month, day, time, lat, lon, lagna, lo, hi) => {
    const chart = computeFullChartSync({ year, month, day, time } as never, place(lat, lon) as never);
    expect(chart.lagna).toBe(lagna);
    const deg = chart.lagnaDegreeInSign ?? 99;
    expect(deg).toBeGreaterThanOrEqual(lo - 0.15);
    expect(deg).toBeLessThanOrEqual(hi + 0.15);
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

describe("formula Ketu", () => {
  it("is the Thai Ketu, not the node opposite Rahu", () => {
    // 18 Nov 2001 02:08 — astro.meemodel.com: เกตุ มีน 23°28'.
    const t = MakeTime(new Date(Date.UTC(2001, 10, 17, 19, 8)));
    const ketu = computeSiderealPlanets(t).get("เกตุ")!;
    expect(ketu.siderealSign).toBe("มีน");
    expect(Math.abs(ketu.siderealLongitude - (330 + 23 + 28 / 60))).toBeLessThan(0.1);
  });

  it("moves backwards about 0.53° a day", () => {
    const at = (iso: string) =>
      computeSiderealPlanets(MakeTime(new Date(iso))).get("เกตุ")!.siderealLongitude;
    const step = (at("1925-03-10T05:00:00Z") - at("1925-04-09T05:00:00Z") + 360) % 360;
    expect(step).toBeCloseTo(15.9, 0);
  });
});

describe("a sign change during the birth day", () => {
  // The 100-year table holds each day's END; myhora (production) had these
  // at the birth moment.
  it("keeps the Moon in the sign it was in at birth", () => {
    const c = computeNatalChartFormula({ year: 1974, month: 1, day: 15, time: "03:27", country: "ไทย", province: "บุรีรัมย์", district: "พลับพลาชัย" });
    expect(c.planets.find((p) => p.planet === "จันทร์")?.siderealSign).toBe("กันย์"); // myhora กันย์ 23°47'
  });

  it("keeps the Sun in the sign it was in at birth", () => {
    const c = computeNatalChartFormula({ year: 1950, month: 12, day: 16, time: "02:59", country: "ไทย", province: "น่าน", district: "บ้านหลวง" });
    expect(c.planets.find((p) => p.planet === "อาทิตย์")?.siderealSign).toBe("พิจิก"); // myhora พิจิก 29°51'
  });
});

describe("taksa birth day turns at the real sunrise and sunset", () => {
  // myhora's answers (QA, 4 Oct 2026); fixed 06:00/18:00 got all four wrong.
  it.each([
    [2000, 1, 12, "06:20", "กรุงเทพมหานคร", "พระนคร", "อังคาร"],
    [2000, 6, 14, "05:56", "กรุงเทพมหานคร", "พระนคร", "พุธกลางวัน"],
    [2000, 6, 14, "18:20", "กรุงเทพมหานคร", "พระนคร", "พุธกลางวัน"],
    [1996, 3, 3, "06:10", "สุราษฎร์ธานี", "เมืองสุราษฎร์ธานี", "เสาร์"],
  ] as const)("%i-%i-%i %s %s", async (year, month, day, time, province, district, want) => {
    await import("@/server/horoscope/engine/taksa-boundaries");
    const { resolveTaksaBirthDay } = await import("@/lib/taksa");
    expect(resolveTaksaBirthDay({ year, month, day, time, country: "ไทย", province, district })).toBe(want);
  });
});

// QA 2026-10-04 (B11): the table's first day has no row before it.
describe("the 100-year table's first day", () => {
  it("places the Moon by its birth-moment position", async () => {
    const { computeFullChartSync } = await import("@/server/horoscope/engine/newhora/formulas/pipeline");
    const { resolvePlaceCoords } = await import("@/server/horoscope/engine/newhora/data/placeCoordinates");
    const input = { day: 1, month: 1, year: 1941, time: "01:00", country: "ไทย", province: "กรุงเทพมหานคร", district: "พระนคร" };
    const r = computeFullChartSync(input as never, resolvePlaceCoords("ไทย", "กรุงเทพมหานคร", "พระนคร", input));
    expect(r.planets.find((p) => p.planet === "จันทร์")?.siderealSign).toBe("มกร");
  });
});
