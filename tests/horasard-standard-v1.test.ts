import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { CALCULATION_SETTINGS } from "@/server/horoscope/engine/newhora/data/calculationSettings";

type GoldenCase = {
  id: string;
  authority: "myhora-parity" | "formula-locked" | "suryayat-year-locked";
  notes?: string;
  input: {
    day: number;
    month: number;
    year: number;
    time: string;
    country: string;
    province: string;
    district: string;
  };
  expect: {
    source: string;
    lagna: string;
    planets: Record<string, string>;
    taksaCountMin: number;
  };
};

type GoldenDoc = {
  version: string;
  lockedAt: string;
  cases: GoldenCase[];
};

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/horasard-golden-v1.json",
);
const golden = JSON.parse(readFileSync(fixturePath, "utf8")) as GoldenDoc;

describe("HoraSard Standard v1", () => {
  it("declares fixed calculation settings", () => {
    expect(CALCULATION_SETTINGS).toEqual({
      calendar: "suryayat",
      ayanamsa: "lahiri",
      timeMethod: "antonathi_samrap_sunrise_local",
      rahuRule: "eight_signs_aquarius",
      taksaRahuLord: "mercury_night",
      taksaCountFrom: "center",
    });
  });

  it("locks exactly 20 golden cases with known authorities", () => {
    expect(golden.version).toBe("HoraSard-Standard-v1");
    expect(golden.cases).toHaveLength(20);
    const byAuth = Object.fromEntries(
      (["myhora-parity", "formula-locked", "suryayat-year-locked"] as const).map(
        (a) => [a, golden.cases.filter((c) => c.authority === a).length],
      ),
    );
    expect(byAuth).toEqual({
      "myhora-parity": 2,
      "formula-locked": 2,
      "suryayat-year-locked": 16,
    });
  });

  for (const c of golden.cases) {
    it(`${c.id} (${c.authority})`, () => {
      const chart = computeNatalChartFormula(c.input);
      const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "";
      const planets = Object.fromEntries(
        chart.planets.map((p) => [p.planet, p.siderealSign]),
      );

      expect(chart.meta.calculationSource).toBe(c.expect.source);
      expect(lagna).toBe(c.expect.lagna);
      expect(planets).toEqual(c.expect.planets);
      expect(chart.planets).toHaveLength(Object.keys(c.expect.planets).length);
      expect(chart.chart?.taksa?.length ?? 0).toBeGreaterThanOrEqual(
        c.expect.taksaCountMin,
      );

      // Settings on chart must stay on Standard v1 knobs.
      expect(chart.settings).toMatchObject(CALCULATION_SETTINGS);
    });
  }
});
