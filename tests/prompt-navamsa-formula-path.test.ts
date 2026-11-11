import { describe, expect, it } from "vitest";
import {
  formatChartCompactForPrompt,
  formatChartForPrompt,
} from "@/server/horoscope/engine/format-chart-prompt";
import type { ChartJson } from "@/types/chart";

// 11 Nov 2026: a chart with no สมผุส table showed นวางค์ on screen (derived from
// degrees) but the prompt carried sign + house only, so the reading said
// "ไม่มีข้อมูลนวางค์". Positions from the chart A sent (ลัคนา กันย์).
const planets: Array<[string, string, number]> = [
  ["อาทิตย์", "พิจิก", 1 + 8 / 60],
  ["จันทร์", "ธนู", 3 + 50 / 60],
  ["อังคาร", "มกร", 25 + 49 / 60],
  ["พุธ", "ตุลย์", 26 + 36 / 60],
  ["พฤหัสบดี", "มิถุน", 23],
  ["ศุกร์", "ตุลย์", 15 + 12 / 60],
  ["เสาร์", "พฤษภ", 13 + 15 / 60],
  ["ราหู", "มิถุน", 4 + 49 / 60],
  ["เกตุ", "มีน", 23 + 27 / 60],
];
const chart = {
  input: { year: 1990, month: 1, day: 1 },
  meta: { lagna: "กันย์" },
  chart: { lagna: "กันย์" },
  planets: planets.map(([planet, siderealSign, degreeInSign]) => ({ planet, siderealSign, degreeInSign })),
} as unknown as ChartJson;

// The navamsa sign the table on screen shows for each planet.
const expected: Record<string, string> = {
  อาทิตย์: "กรกฎ", จันทร์: "พฤษภ", อังคาร: "สิงห์", พุธ: "พฤษภ", พฤหัสบดี: "เมษ",
  ศุกร์: "กุมภ", เสาร์: "เมษ", ราหู: "พิจิก", เกตุ: "กุมภ",
};

describe("นวางค์ reaches the prompt on the formula path", () => {
  for (const [name, fmt] of [["full", formatChartForPrompt], ["compact", formatChartCompactForPrompt]] as const) {
    it(`${name}: every planet carries the table's นวางค์`, () => {
      const text = fmt(chart);
      for (const [planet, sign] of Object.entries(expected)) {
        const line = text.split("\n").find((l) => l.trimStart().startsWith(planet) && l.includes("นวางค์"));
        expect(line, planet).toBeDefined();
        expect(line!.split("นวางค์").at(-1), planet).toContain(sign);
      }
      expect(text).not.toContain("วรโคตมนวางค์");
    });
  }
});
