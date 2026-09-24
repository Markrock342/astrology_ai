import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartJson } from "@/types/chart";
import { CHART_MEMORY_VOCAB_VERSION } from "@/types/chart-memory";

const mocks = vi.hoisted(() => ({
  findMemory: vi.fn(),
  upsertMemory: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    userChartMemory: {
      findUnique: mocks.findMemory,
      upsert: mocks.upsertMemory,
    },
  },
}));

import { getOrRefreshChartMemory } from "@/server/horoscope/chart-memory-service";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { hashBirthInput } from "@/server/horoscope/engine/derive-chart-memory";

const chart = computeNatalChartFormula({
  day: 29,
  month: 8,
  year: 2026,
  time: "12:00",
  country: "ไทย",
  province: "กรุงเทพมหานคร",
  district: "พระนคร",
}) as ChartJson;

describe("chart-memory Taksa cache version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertMemory.mockResolvedValue({});
  });

  it("rebuilds a same-birth cache produced by the old lagna/sign formula", async () => {
    mocks.findMemory.mockResolvedValue({
      birthHash: hashBirthInput(chart.input),
      memoryJson: {
        lagna: "เมษ",
        birthHash: hashBirthInput(chart.input),
        computedAt: new Date(0).toISOString(),
        taksa: [{ taksa: "กาลกุล", sign: "เมษ" }],
        houseOccupants: [],
        categories: { career: {}, love: {}, money: {}, health: {} },
      },
    });

    const memory = await getOrRefreshChartMemory("user-1", chart);
    expect(mocks.upsertMemory).toHaveBeenCalledOnce();
    expect(memory.taksa).toHaveLength(8);
    expect(memory.taksa[0]).toMatchObject({
      taksa: "บริวาร",
      planet: "เสาร์",
      planetNum: 7,
    });
  });

  it("reuses a current eight-lord cache", async () => {
    const current = {
      // Must match the chart it was derived from, or it is rebuilt.
      lagna: chart.chart?.lagna ?? chart.meta.lagna,
      birthHash: hashBirthInput(chart.input),
      computedAt: new Date().toISOString(),
      vocabVersion: CHART_MEMORY_VOCAB_VERSION,
      taksaBirthDay: "เสาร์",
      taksa: chart.chart!.taksa.map((slot) => ({
        taksa: slot.taksa,
        planet: slot.planet,
        planetNum: slot.planetNum,
      })),
      houseOccupants: [],
      categories: { career: {}, love: {}, money: {}, health: {} },
    };
    mocks.findMemory.mockResolvedValue({
      birthHash: hashBirthInput(chart.input),
      memoryJson: current,
    });

    expect(await getOrRefreshChartMemory("user-1", chart)).toBe(current);
    expect(mocks.upsertMemory).not.toHaveBeenCalled();
  });

  it("rebuilds a memory written with the old dignity words", async () => {
    // No vocabVersion: written before นีจ became นิจ and ประ existed.
    mocks.findMemory.mockResolvedValue({
      birthHash: hashBirthInput(chart.input),
      memoryJson: {
        lagna: chart.chart?.lagna ?? chart.meta.lagna,
        birthHash: hashBirthInput(chart.input),
        computedAt: new Date().toISOString(),
        taksaBirthDay: "เสาร์",
        taksa: chart.chart!.taksa.map((slot) => ({
          taksa: slot.taksa,
          planet: slot.planet,
          planetNum: slot.planetNum,
        })),
        houseOccupants: [],
        categories: { career: {}, love: {}, money: {}, health: {} },
      },
    });
    const memory = await getOrRefreshChartMemory("user-1", chart);
    expect(mocks.upsertMemory).toHaveBeenCalledOnce();
    expect(memory.vocabVersion).toBe(CHART_MEMORY_VOCAB_VERSION);
  });

  it("rebuilds a cache whose lagna no longer matches the chart", async () => {
    // A chart recomputed after the 'เมษ' fallback fix keeps the same birth
    // input — the cache key — so only this comparison catches the stale memory.
    const lagna = chart.chart?.lagna ?? chart.meta.lagna;
    const stale = {
      lagna: lagna === "เมษ" ? "ตุลย์" : "เมษ",
      birthHash: hashBirthInput(chart.input),
      computedAt: new Date().toISOString(),
      vocabVersion: CHART_MEMORY_VOCAB_VERSION,
      taksaBirthDay: "เสาร์",
      taksa: chart.chart!.taksa.map((slot) => ({
        taksa: slot.taksa,
        planet: slot.planet,
        planetNum: slot.planetNum,
      })),
      houseOccupants: [],
      categories: { career: {}, love: {}, money: {}, health: {} },
    };
    mocks.findMemory.mockResolvedValue({
      birthHash: hashBirthInput(chart.input),
      memoryJson: stale,
    });

    const memory = await getOrRefreshChartMemory("user-1", chart);
    expect(mocks.upsertMemory).toHaveBeenCalledOnce();
    expect(memory.lagna).toBe(lagna);
  });
});
