import { describe, expect, it } from "vitest";
import { computePublicNatalChart } from "@/server/horoscope/public-chart-service";

describe("public natal calculator", () => {
  it("accepts a Buddhist year and returns lagna plus planet rows", () => {
    const chart = computePublicNatalChart({
      year: 2549,
      month: 5,
      day: 21,
      yearEra: "BE",
      birthTimeKnown: true,
      hour: 18,
      minute: 31,
      birthCountry: "ไทย",
      birthProvince: "กรุงเทพมหานคร",
      birthDistrict: "พระนคร",
    });

    expect(chart.input.year).toBe(2006);
    expect(chart.input.time).toBe("18:31");
    expect(chart.planets).toHaveLength(10);
    expect(chart.chart?.lagna).toBeTruthy();
  });

  it("uses noon when birth time is unknown", () => {
    const chart = computePublicNatalChart({
      year: 2006,
      month: 5,
      day: 21,
      yearEra: "CE",
      birthTimeKnown: false,
      birthCountry: "ไทย",
      birthProvince: "กรุงเทพมหานคร",
      birthDistrict: "พระนคร",
    });

    expect(chart.input.time).toBe("12:00");
  });
});
