import { describe, expect, it } from "vitest";
import {
  computeNatalChartFormula,
  computeNatalChartSync,
} from "@/server/horoscope/engine/compute-chart";
import { formatChartForPrompt } from "@/server/horoscope/engine/format-chart-prompt";
import { buildSystemPrompt, buildUserPrompt, ENGINE_CHART_RULE } from "@/server/ai/prompt-builder";

const SAMPLE_INPUT = {
  day: 21,
  month: 5,
  year: 2006,
  time: "18:31",
  country: "ไทย",
  province: "กรุงเทพมหานคร",
  district: "พระนคร",
} as const;

describe("natal chart engine (formula path)", () => {
  it("computes lagna, 10 planets, and degree text via formula path", () => {
    const chart = computeNatalChartFormula({ ...SAMPLE_INPUT });

    expect(chart.planets).toHaveLength(10);
    expect(chart.chart?.lagna).toBeTruthy();
    expect(chart.meta.calculationSource).toMatch(/formula-pipeline|suryayat-100/);
    expect(chart.planets.every((p) => p.siderealSign && p.siderealSign !== "—")).toBe(true);
    if (chart.meta.calculationSource === "formula-pipeline") {
      expect(chart.planets.some((p) => p.degreeText)).toBe(true);
    }
  });

  it("formats full taksa and planet table for AI prompt", () => {
    const chart = computeNatalChartFormula({
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
    expect(text).toContain("ตารางตำแหน่งดาว");
    expect(text).toContain("อาทิตย์");
    expect(text).toContain("เรือน");
    expect(text).toContain("ทักษา");
    expect(text).toContain("สัมพันธ์ดาว");
    expect(chart.chart?.taksa?.length).toBeGreaterThanOrEqual(6);
  });

  it("computes a distinct transit chart for another moment", () => {
    const natal = computeNatalChartSync({ ...SAMPLE_INPUT });
    const transit = computeNatalChartSync({
      day: 11,
      month: 7,
      year: 2026,
      time: "14:00",
      country: "ไทย",
      province: "กรุงเทพมหานคร",
      district: "พระนคร",
    });
    expect(transit.planets).toHaveLength(10);
    expect(transit.meta.birthDisplay).not.toEqual(natal.meta.birthDisplay);
  });
});

describe("engine-first prompts", () => {
  it("injects natal chart before the question and forbids inventing planets", () => {
    const chart = computeNatalChartFormula({ ...SAMPLE_INPUT });
    const system = buildSystemPrompt({
      safety: "safety",
      persona: "persona",
      plan: "plan",
      category: "category",
      outputFormat: "format",
    });
    expect(system).toContain(ENGINE_CHART_RULE);

    const user = buildUserPrompt(
      {
        nickname: "ทดสอบ",
        birthDate: "2006-05-21",
        birthTime: "18:31",
        birthTimeKnown: true,
        gender: null,
        birthLocation: "กรุงเทพ",
        additionalInfo: null,
      },
      "งานช่วงนี้เป็นอย่างไร",
      chart,
    );
    expect(user.indexOf("[natal]")).toBeLessThan(user.indexOf("คำถาม:"));
    expect(user).toContain("ลัคนา");
    expect(user).toContain("งานช่วงนี้เป็นอย่างไร");
  });

  it("appends transit block when provided", () => {
    const natal = computeNatalChartFormula({ ...SAMPLE_INPUT });
    const transit = computeNatalChartFormula({
      day: 11,
      month: 7,
      year: 2026,
      time: "14:00",
      country: "ไทย",
      province: "กรุงเทพมหานคร",
      district: "พระนคร",
    });
    const user = buildUserPrompt(
      {
        nickname: null,
        birthDate: "2006-05-21",
        birthTime: "18:31",
        birthTimeKnown: true,
        gender: null,
        birthLocation: null,
        additionalInfo: null,
      },
      "ดวงจรวันนี้",
      natal,
      transit,
    );
    expect(user).toContain("[transit]");
    expect(user.indexOf("[natal]")).toBeLessThan(user.indexOf("[transit]"));
  });
});
