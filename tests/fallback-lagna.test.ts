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
