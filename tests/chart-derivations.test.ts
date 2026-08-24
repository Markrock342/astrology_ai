import { describe, expect, it } from "vitest";
import {
  chartFromMyhoraRows,
  computeDrekkanaSign,
  computeNavamsaSign,
  deriveDivisionalChart,
  formatMyhoraDegreeText,
} from "@/lib/chart-derivations";
import type { ChartJson } from "@/types/chart";
import type { MyhoraNatalPlanet } from "@/types/myhora";

const rows: MyhoraNatalPlanet[] = [
  {
    planet: "ล.ลัคนา",
    zodiac: "สิงห์",
    degree: "๑๐",
    minute: "๓๐",
  },
  {
    planet: "๑.อาทิตย์",
    zodiac: "มิถุน",
    degree: "5",
    minute: "10",
  },
  {
    planet: "๒.จันทร์",
    zodiac: "07 : พจ",
    degree: "20",
    minute: "0",
  },
];

const fallback = {
  lagna: "เมษ",
  planets: [
    { planet: "อาทิตย์", siderealSign: "เมษ" },
    { planet: "จันทร์", siderealSign: "พฤษภ" },
    { planet: "อังคาร", siderealSign: "มิถุน" },
  ],
};

describe("chart derivations for HoraSard SVG charts", () => {
  it("maps MyHora rows, Thai digits, signs and degrees", () => {
    const chart = chartFromMyhoraRows(rows, fallback);

    expect(chart?.lagna).toBe("สิงห์");
    expect(chart?.planets).toHaveLength(3);
    expect(chart?.planets[0]).toMatchObject({
      planet: "อาทิตย์",
      siderealSign: "มิถุน",
      degreeInSign: 5 + 10 / 60,
    });
    expect(chart?.planets[1]).toMatchObject({
      planet: "จันทร์",
      siderealSign: "พิจิก",
      degreeInSign: 20,
    });
    // A partial scrape must not erase planets already present in the engine.
    expect(chart?.planets[2]).toEqual(fallback.planets[2]);
  });

  it("formats the minute mark before MyHora motion markers", () => {
    expect(
      formatMyhoraDegreeText({ degree: "20", minute: "55 ส." }),
    ).toBe("20°55′ ส.");
    expect(formatMyhoraDegreeText({ degree: "03", minute: "37" })).toBe(
      "03°37′",
    );
  });

  it("uses the same D9/D3 functions for client charts and engine formulas", async () => {
    const engine = await import(
      "@/server/horoscope/engine/newhora/formulas/divisionalCharts"
    );
    const cases = [
      ["เมษ", 2],
      ["พฤษภ", 11],
      ["มิถุน", 27],
      ["พิจิก", 19],
    ] as const;

    for (const [sign, degree] of cases) {
      expect(computeNavamsaSign(sign, degree)).toBe(
        engine.computeNavamsaSign(sign, degree),
      );
      expect(computeDrekkanaSign(sign, degree)).toBe(
        engine.computeDrekkanaSign(sign, degree),
      );
    }
  });

  it("derives D9/D3 from the stored MyHora degrees", () => {
    const chart: ChartJson = {
      input: {
        day: 1,
        month: 1,
        year: 2000,
        time: "12:00",
        country: "ไทย",
        province: "กรุงเทพมหานคร",
        district: "พระนคร",
      },
      calculatedAt: new Date(0).toISOString(),
      settings: {
        calendar: "suryayat",
        ayanamsa: "lahiri",
        timeMethod: "antonathi_samrap_sunrise_local",
        rahuRule: "eight_signs_aquarius",
        taksaRahuLord: "mercury_night",
        taksaCountFrom: "center",
      },
      meta: {
        birthDisplay: "test",
        locationDisplay: "test",
        calculationSource: "myhora-scrape",
        lagna: "สิงห์",
      },
      planets: fallback.planets,
      chart: { lagna: "สิงห์", taksa: [] },
      myhora: {
        lagnaSign: "สิงห์",
        summaryNatal: null,
        summaryTransit: null,
        natalPlanets: [
          ...rows,
          {
            planet: "๓.อังคาร",
            zodiac: "มิถุน",
            degree: "12",
            minute: "30",
          },
        ],
        transitPlanets: null,
        taksa: [],
        triwaiNatal: [],
        triwaiTransit: [],
      },
    };

    const d9 = deriveDivisionalChart(chart, "navamsa");
    const d3 = deriveDivisionalChart(chart, "drekkana");

    expect(d9).not.toBeNull();
    expect(d3).not.toBeNull();
    if (!d9 || !d3) throw new Error("expected complete MyHora divisional charts");
    expect(d9.lagna).toBe(computeNavamsaSign("สิงห์", 10.5));
    expect(d9.planets[0]?.siderealSign).toBe(
      computeNavamsaSign("มิถุน", 5 + 10 / 60),
    );
    expect(d3.planets[1]?.siderealSign).toBe(
      computeDrekkanaSign("พิจิก", 20),
    );
  });

  it("does not invent D9/D3 from a 15-degree placeholder", () => {
    const chart: ChartJson = {
      input: {
        day: 18,
        month: 11,
        year: 2001,
        time: "02:08",
        country: "ไทย",
        province: "นครราชสีมา",
        district: "โชคชัย",
      },
      calculatedAt: new Date(0).toISOString(),
      settings: {
        calendar: "suryayat",
        ayanamsa: "lahiri",
        timeMethod: "antonathi_samrap_sunrise_local",
        rahuRule: "eight_signs_aquarius",
        taksaRahuLord: "mercury_night",
        taksaCountFrom: "birth-weekday",
      },
      meta: {
        birthDisplay: "test",
        locationDisplay: "test",
        calculationSource: "suryayat-100-year",
        lagna: "เมษ",
      },
      planets: fallback.planets,
      chart: { lagna: "เมษ", taksa: [] },
    };

    expect(deriveDivisionalChart(chart, "navamsa")).toBeNull();
    expect(deriveDivisionalChart(chart, "drekkana")).toBeNull();
  });
});
