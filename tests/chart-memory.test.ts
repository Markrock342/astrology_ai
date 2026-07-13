import { describe, expect, it } from "vitest";
import {
  deriveChartMemory,
  formatMemoryForPrompt,
  hashBirthInput,
  memoryKeyForCategory,
  resolveMemoryFocusKeys,
} from "@/server/horoscope/engine/derive-chart-memory";
import { questionWantsTodayTransit, bangkokDateKey } from "@/server/horoscope/daily-transit-service";
import type { ChartJson } from "@/types/chart";

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
  planets: [
    { planet: "อาทิตย์", siderealSign: "มกร" },
    { planet: "จันทร์", siderealSign: "สิงห์" },
    { planet: "อังคาร", siderealSign: "พิจิก" },
    { planet: "พุธ", siderealSign: "ธนู" },
    { planet: "พฤหัสบดี", siderealSign: "มิถุน" },
    { planet: "ศุกร์", siderealSign: "มกร" },
    { planet: "เสาร์", siderealSign: "ธนู" },
    { planet: "ราหู", siderealSign: "มกร" },
    { planet: "เกตุ", siderealSign: "สิงห์" },
    { planet: "มฤตยู", siderealSign: "ธนู" },
  ],
  chart: {
    lagna: "เมษ",
    taksa: [{ taksa: "กาลกุล", sign: "เมษ", index: 0 }],
  },
} as ChartJson;

describe("deriveChartMemory", () => {
  it("builds lagna, hash, and category focuses from engine chart", () => {
    const memory = deriveChartMemory(chart);
    expect(memory.lagna).toBe("เมษ");
    expect(memory.birthHash).toBe(hashBirthInput(chart.input));
    expect(memory.categories.career.houses).toEqual([10, 6, 2]);
    expect(memory.categories.love.houses).toEqual([7, 5]);
    expect(memory.taksa[0]?.taksa).toBe("กาลกุล");
    expect(memory.houseOccupants).toHaveLength(12);
  });

  it("formats memory prompt with [memory] and category focus", () => {
    const memory = deriveChartMemory(chart);
    const text = formatMemoryForPrompt(memory, "career");
    expect(text).toContain("[memory]");
    expect(text).toContain("งาน/อาชีพ");
    expect(text).not.toContain("ความรัก:");
  });

  it("maps category slugs", () => {
    expect(memoryKeyForCategory("career")).toBe("career");
    expect(memoryKeyForCategory("love")).toBe("love");
    expect(memoryKeyForCategory("finance")).toBe("money");
    expect(memoryKeyForCategory("fortune")).toBe("money");
    expect(memoryKeyForCategory("self")).toBeNull();
    expect(memoryKeyForCategory("overview")).toBeNull();
    expect(memoryKeyForCategory("unknown")).toBeNull();
  });

  it("includes multiple memory focuses when the question crosses topics", () => {
    const keys = resolveMemoryFocusKeys({
      categorySlug: "career",
      question: "แล้วเรื่องความรักช่วงนี้เป็นอย่างไร",
    });
    expect(keys).toEqual(["career", "love"]);

    const text = formatMemoryForPrompt(deriveChartMemory(chart), {
      categorySlug: "career",
      question: "แล้วเรื่องความรักช่วงนี้เป็นอย่างไร",
    });
    expect(text).toContain("งาน/อาชีพ");
    expect(text).toContain("ความรัก:");
  });

  it("recalls topics mentioned in prior user turns", () => {
    const keys = resolveMemoryFocusKeys({
      categorySlug: "career",
      question: "สรุปให้หน่อย",
      priorUserTexts: ["ช่วงนี้การเงินเป็นอย่างไร"],
    });
    expect(keys).toEqual(["career", "money"]);
  });

  it("sends all focuses for self/overview threads", () => {
    expect(
      resolveMemoryFocusKeys({ categorySlug: "self", question: "จุดแข็งของฉัน" }),
    ).toBeNull();
    const text = formatMemoryForPrompt(deriveChartMemory(chart), {
      categorySlug: "self",
      question: "จุดแข็งของฉัน",
    });
    expect(text).toContain("งาน/อาชีพ");
    expect(text).toContain("ความรัก:");
    expect(text).toContain("การเงิน:");
    expect(text).toContain("สุขภาพ:");
  });
});

describe("daily transit helpers", () => {
  it("detects today-oriented questions", () => {
    expect(questionWantsTodayTransit("วันนี้งานเป็นไง")).toBe(true);
    expect(questionWantsTodayTransit("พื้นดวงเรื่องรัก")).toBe(false);
  });

  it("formats bangkok date key as YYYY-MM-DD", () => {
    expect(bangkokDateKey(new Date("2026-07-12T10:00:00+07:00"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});
