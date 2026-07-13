import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ChartJson } from "@/types/chart";
import { deriveChartMemory } from "@/server/horoscope/engine/derive-chart-memory";

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
  planets: [{ planet: "อาทิตย์", siderealSign: "มกร" }],
  chart: { lagna: "เมษ", taksa: [] },
} as ChartJson;

vi.mock("@/server/db", () => ({
  prisma: {
    get userChartMemory() {
      return undefined;
    },
  },
}));

describe("getOrRefreshChartMemory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("derives memory in-process when prisma model is missing", async () => {
    const { getOrRefreshChartMemory } = await import(
      "@/server/horoscope/chart-memory-service"
    );
    const memory = await getOrRefreshChartMemory("user-1", chart);
    const expected = deriveChartMemory(chart);
    expect(memory.lagna).toBe(expected.lagna);
    expect(memory.birthHash).toBe(expected.birthHash);
    expect(memory.categories).toEqual(expected.categories);
  });
});
