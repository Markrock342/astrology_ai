import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchMyhoraThaiChart: vi.fn() }));

vi.mock("@/server/horoscope/engine/myhora/fetch-myhora", () => ({
  fetchMyhoraThaiChart: mocks.fetchMyhoraThaiChart,
  isMyhoraScrapeEnabled: () => true,
}));

import { computeTransitChart } from "@/server/horoscope/engine/compute-chart";

const birth = {
  day: 19,
  month: 6,
  year: 2001,
  time: "22:43",
  country: "ไทย",
  province: "สกลนคร",
  district: "สว่างแดนดิน",
};

describe("computeTransitChart", () => {
  it("never returns the natal positions when the scrape has no transit table", async () => {
    // A scrape keyed on the birth data: its planet table IS the natal chart.
    mocks.fetchMyhoraThaiChart.mockResolvedValue({
      planets: [{ planet: "เสาร์", siderealSign: "พฤษภ", degreeText: "08° 59'" }],
      lagna: "มกร",
      tables: {
        lagnaSign: "มกร",
        natalPlanets: [{ planet: "๗.เสาร์", zodiac: "พฤษภ", degree: "8", minute: "59" }],
        transitPlanets: [],
      },
    });

    const transitDay = { ...birth, day: 15, month: 9, year: 2036, time: "12:00" };
    const chart = await computeTransitChart(transitDay, birth, { scrapeTimeoutMs: 500 });

    expect(mocks.fetchMyhoraThaiChart).toHaveBeenCalledWith(
      birth,
      expect.objectContaining({ lite: true, includeTransit: true }),
    );
    // Formula engine for the transit day — not "myhora-scrape" carrying natal rows.
    expect(chart.meta.calculationSource).not.toBe("myhora-scrape");
    expect(chart.input.year).toBe(2036);
    const saturn = chart.planets.find((p) => p.planet === "เสาร์");
    expect(saturn).toBeDefined();
    expect(saturn?.siderealSign).not.toBe("พฤษภ");
  });

  it("uses the transit table when the scrape provides one", async () => {
    mocks.fetchMyhoraThaiChart.mockResolvedValue({
      planets: [{ planet: "เสาร์", siderealSign: "พฤษภ", degreeText: "08° 59'" }],
      lagna: "มกร",
      tables: {
        lagnaSign: "มกร",
        summaryNatal: null,
        summaryTransit: null,
        dateDetailNatal: null,
        dateDetailTransit: null,
        chartEmbeds: { natalAnalysis: null, natalSvg: null, rasi: null, navamsa: null, drekkana: null },
        widgetEmbeds: { taksa: null, triwai: null },
        contentEmbeds: {},
        natalPlanets: [{ planet: "๗.เสาร์", zodiac: "พฤษภ", degree: "8", minute: "59" }],
        transitPlanets: [
          { planet: "ลัคนา", zodiac: "เมษ", degree: "0", minute: "0" },
          { planet: "๗.เสาร์", zodiac: "กรกฎ", degree: "3", minute: "10" },
        ],
        transit: { day: 15, month: 9, year: 2036, time: "12:00" },
        taksa: [],
        triwaiNatal: [],
        triwaiTransit: [],
      },
    });

    const transitDay = { ...birth, day: 15, month: 9, year: 2036, time: "12:00" };
    const chart = await computeTransitChart(transitDay, birth, { scrapeTimeoutMs: 500 });

    expect(chart.meta.calculationSource).toBe("myhora-scrape");
    expect(chart.planets.find((p) => p.planet === "เสาร์")?.siderealSign).toBe("กรกฎ");
    expect(chart.myhora?.transitPlanets).toHaveLength(2);
  });
});
