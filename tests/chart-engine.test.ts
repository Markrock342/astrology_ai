import { describe, expect, it } from "vitest";
import { computeNatalChart } from "@/server/horoscope/engine/compute-chart";
import { formatChartForPrompt } from "@/server/horoscope/engine/format-chart-prompt";

describe("natal chart engine", () => {
  it("computes lagna and 10 planets", () => {
    const chart = computeNatalChart({
      day: 21,
      month: 5,
      year: 2006,
      time: "18:31",
      country: "ไทย",
      province: "กรุงเทพมหานคร",
      district: "พระนคร",
    });

    expect(chart.planets).toHaveLength(10);
    expect(chart.chart?.lagna).toBeTruthy();
    expect(chart.meta.calculationSource).toBe("formula-pipeline");
    expect(chart.planets.every((p) => p.siderealSign && p.siderealSign !== "—")).toBe(true);
  });

  it("formats chart text for AI prompt", () => {
    const chart = computeNatalChart({
      day: 1,
      month: 1,
      year: 1990,
      time: "10:00",
      country: "ไทย",
      province: "เชียงใหม่",
      district: "เมืองเชียงใหม่",
    });
    const text = formatChartForPrompt(chart);
    expect(text).toContain("ลัคนา");
    expect(text).toContain("อาทิตย์:");
  });
});
