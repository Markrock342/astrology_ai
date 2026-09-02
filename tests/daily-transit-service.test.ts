import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bangkokDateKey,
  bangkokTimeHm,
  getOrComputeDailyTransit,
} from "@/server/horoscope/daily-transit-service";
import type { ChartJson } from "@/types/chart";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  computeTransitChart: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    dailyTransitCache: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/server/horoscope/engine/compute-chart", () => ({
  computeTransitChart: mocks.computeTransitChart,
}));

vi.mock("@/server/horoscope/chart-context", () => ({
  assertUsableEngineChart: (chart: unknown) => chart,
  isUsableEngineChart: (chart: unknown) => Boolean(chart),
}));

const natalChart = {
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
    birthDisplay: "15/1/1990 08:30",
    locationDisplay: "พระนคร, กรุงเทพมหานคร",
    calculationSource: "formula-pipeline",
    lagna: "เมษ",
  },
  planets: [],
  chart: { lagna: "เมษ", taksa: [] },
} as unknown as ChartJson;

describe("bangkok time helpers", () => {
  it("formats bangkok date key as YYYY-MM-DD", () => {
    expect(bangkokDateKey(new Date("2026-07-12T10:00:00+07:00"))).toBe(
      "2026-07-12",
    );
  });

  it("formats bangkok HH:mm", () => {
    expect(bangkokTimeHm(new Date("2026-07-12T15:07:00+07:00"))).toBe("15:07");
  });
});

describe("getOrComputeDailyTransit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({});
    mocks.computeTransitChart.mockResolvedValue({
      ...natalChart,
      input: {
        ...natalChart.input,
        day: 2,
        month: 9,
        year: 2026,
        time: "14:22",
        province: "เชียงใหม่",
        district: "เมืองเชียงใหม่",
      },
      meta: {
        ...natalChart.meta,
        locationDisplay: "เมืองเชียงใหม่, เชียงใหม่",
      },
    });
  });

  it("uses conversation place and skips cache when skipCache is set", async () => {
    mocks.findUnique.mockResolvedValue({
      chartJson: { ...natalChart, meta: { ...natalChart.meta, lagna: "Cached" } },
    });

    await getOrComputeDailyTransit("user-1", natalChart, {
      date: new Date("2026-09-02T07:00:00+07:00"),
      time: "14:22",
      place: {
        country: "ไทย",
        province: "เชียงใหม่",
        district: "เมืองเชียงใหม่",
      },
      skipCache: true,
    });

    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.computeTransitChart).toHaveBeenCalledWith(
      expect.objectContaining({
        province: "เชียงใหม่",
        district: "เมืองเชียงใหม่",
        time: "14:22",
        day: 2,
        month: 9,
        year: 2026,
      }),
      natalChart.input,
      expect.any(Object),
    );
  });

  it("falls back to natal place and uses day cache when place omitted", async () => {
    await getOrComputeDailyTransit("user-1", natalChart, {
      date: new Date("2026-09-02T07:00:00+07:00"),
      time: "12:00",
    });

    expect(mocks.findUnique).toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.computeTransitChart).toHaveBeenCalledWith(
      expect.objectContaining({
        province: "กรุงเทพมหานคร",
        district: "พระนคร",
      }),
      natalChart.input,
      expect.any(Object),
    );
  });
});
