import { describe, expect, it } from "vitest";
import { checkAnswerAgainstTrace } from "@/lib/reading-trace-check";
import type { ReadingPromptTrace } from "@/types/reading-trace";

const trace: ReadingPromptTrace = {
  version: 1,
  createdAt: "2026-09-16T00:00:00.000Z",
  question: "การงานเป็นยังไง",
  answerMode: "detailed",
  plan: "PRO",
  intent: "transit",
  window: { label: "16 ก.ย. 2569", sampleAt: "2026-09-16T05:00:00.000Z", horizonAt: null, pickedByUser: true },
  natal: {
    lagna: "ตุลย์",
    birthDisplay: "19/06/2002 22:43",
    source: "myhora-scrape",
    planets: [
      { planet: "เสาร์", sign: "พฤษภ" },
      { planet: "ศุกร์", sign: "กรกฎ" },
    ],
  },
  transit: {
    lagna: "ตุลย์",
    asOf: "16/9/2026 12:00",
    source: "myhora-scrape",
    planets: [{ planet: "เสาร์", sign: "มีน" }],
  },
  knowledge: { budgetChars: 28000, usedChars: 0, chunks: [] },
  templates: { system: null, persona: null, format: null },
  model: null,
  systemPrompt: "",
  userPrompt: "",
};

describe("checkAnswerAgainstTrace", () => {
  it("confirms placements that match the natal or transit tables", () => {
    const result = checkAnswerAgainstTrace(
      "ดาวเสาร์ (๗) ในพื้นดวงอยู่ราศีพฤษภ ส่วนดาวเสาร์จรสถิตราศีมีน ลัคนาของคุณอยู่ราศีตุลย์",
      trace,
    );
    expect(result.flags).toEqual([]);
    expect(result.confirmed).toBe(3);
  });

  it("flags a planet placed in a sign that is in neither table", () => {
    const result = checkAnswerAgainstTrace("ดาวเสาร์ยังคงสถิตอยู่ที่ราศีกุมภ์ ทำให้…", trace);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0]).toMatchObject({ kind: "planet_sign" });
    expect(result.flags[0]?.detail).toContain("เสาร์");
    expect(result.flags[0]?.detail).toContain("กุมภ์");
  });

  it("flags a lagna that differs from the natal chart", () => {
    const result = checkAnswerAgainstTrace("ลัคนาสถิตราศีกันย์ จึง…", trace);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0]).toMatchObject({ kind: "lagna" });
  });

  it("ignores planets the tables do not carry", () => {
    const result = checkAnswerAgainstTrace("ดาวราหูอยู่ราศีมิถุน", trace);
    expect(result.flags).toEqual([]);
    expect(result.confirmed).toBe(0);
  });
});
