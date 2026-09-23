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

describe("terms the answer invents", () => {
  const withPrompt = (systemPrompt: string): ReadingPromptTrace => ({
    ...trace,
    systemPrompt,
  });

  it("flags a position name that is in no ตำรา that was sent", () => {
    // The real complaint: "สวักษ์" keeps appearing and exists in no source.
    const result = checkAnswerAgainstTrace(
      "ดาวศุกร์ (๖) ซึ่งได้ตำแหน่งสวักษ์ ส่งผลให้การเงินดีขึ้น",
      withPrompt("[knowledge] ตำราทักษา: มหาจักร ราชาโชค กาลกิณี"),
    );
    const flag = result.flags.find((f) => f.kind === "unknown_term");
    expect(flag).toBeDefined();
    expect(flag?.detail).toContain("สวัก");
  });

  it("stays quiet when the term really is in the material", () => {
    const result = checkAnswerAgainstTrace(
      "ดาวอังคารได้ตำแหน่งมหาจักร จึงมีพลังในการลงมือทำ",
      withPrompt("[knowledge] ตำรา: ดาวที่ได้ตำแหน่งมหาจักร หมายถึงผู้มีอำนาจ"),
    );
    expect(result.flags.filter((f) => f.kind === "unknown_term")).toHaveLength(0);
  });

  it("does not flag ordinary words after the lead-in", () => {
    const result = checkAnswerAgainstTrace(
      "ตำแหน่งงานที่เหมาะกับคุณคือสายประสานงาน",
      withPrompt("[knowledge] เรือนกัมมะว่าด้วยตำแหน่งงานและอาชีพการงาน"),
    );
    expect(result.flags.filter((f) => f.kind === "unknown_term")).toHaveLength(0);
  });

  it("skips the check on old rows that stored no prompt", () => {
    const result = checkAnswerAgainstTrace(
      "ได้ตำแหน่งสวักษ์",
      withPrompt(""),
    );
    expect(result.flags.filter((f) => f.kind === "unknown_term")).toHaveLength(0);
  });
});

describe("the chart table's own wording", () => {
  it("no longer ships the retired own-sign label", async () => {
    // "สวักษ์" came from our own dignity table, not from the model, so it kept
    // reappearing in answers however the prompt was worded.
    const { readFileSync } = await import("node:fs");
    const files = [
      "src/server/horoscope/engine/format-chart-prompt.ts",
      "src/server/horoscope/engine/derive-chart-memory.ts",
      "src/server/ai/prompt-builder.ts",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const code = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(code, file).not.toContain("สวักษ์");
    }
  });
});
