import { describe, expect, it } from "vitest";
import {
  buildConversationHistory,
  trimConversationHistory,
} from "@/server/ai/prompt-builder";
import type { BirthProfileSnapshot } from "@/types";
import type { ChartJson } from "@/types/chart";
import { deriveChartMemory } from "@/server/horoscope/engine/derive-chart-memory";

const profile: BirthProfileSnapshot = {
  nickname: "ทดสอบ",
  birthDate: "1990-01-15T00:00:00.000Z",
  birthTime: "08:30",
  birthTimeKnown: true,
  gender: "หญิง",
  birthLocation: "กรุงเทพฯ",
  additionalInfo: null,
};

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
  meta: { calculationSource: "formula-pipeline", lagna: "เมษ" },
  planets: [
    { planet: "อาทิตย์", siderealSign: "เมษ" },
    { planet: "จันทร์", siderealSign: "พฤษภ" },
    { planet: "อังคาร", siderealSign: "เมษ" },
    { planet: "พุธ", siderealSign: "เมษ" },
    { planet: "พฤหัสบดี", siderealSign: "กรกฎ" },
    { planet: "ศุกร์", siderealSign: "มีน" },
    { planet: "เสาร์", siderealSign: "มกร" },
    { planet: "ราหู", siderealSign: "ธนู" },
    { planet: "เกตุ", siderealSign: "มิถุน" },
    { planet: "มฤตยู", siderealSign: "พิจิก" },
  ],
  chart: { lagna: "เมษ", taksa: [] },
} as unknown as ChartJson;

const memory = deriveChartMemory(chart);

describe("buildConversationHistory (M3 B1)", () => {
  it("requires engine natal chart on every turn", () => {
    expect(() =>
      buildConversationHistory(
        [],
        profile,
        // @ts-expect-error intentional invalid chart
        { meta: {}, planets: [] },
        "เรื่องความรักเป็นอย่างไร",
      ),
    ).toThrow();
  });

  it("returns full user prompt with natal + memory when thread is empty", () => {
    const { conversationHistory, userPrompt } = buildConversationHistory(
      [],
      profile,
      chart,
      "เรื่องความรักเป็นอย่างไร",
      { chartMemory: memory, categorySlug: "love" },
    );
    expect(conversationHistory).toEqual([]);
    expect(userPrompt).toContain("เรื่องความรักเป็นอย่างไร");
    expect(userPrompt).toContain("ทดสอบ");
    expect(userPrompt).toContain("[natal]");
    expect(userPrompt).toContain("[memory]");
    expect(userPrompt).toContain("คำถาม:");
  });

  it("attaches profile+chart+memory to every current userPrompt (not only first turn)", () => {
    const { conversationHistory, userPrompt } = buildConversationHistory(
      [
        { role: "USER", content: "เรื่องงานเป็นอย่างไร" },
        { role: "ASSISTANT", content: "งานของคุณมีโอกาสดี" },
      ],
      profile,
      chart,
      "แล้วเรื่องความรักล่ะ",
      { chartMemory: memory, categorySlug: "love" },
    );
    expect(userPrompt).toContain("แล้วเรื่องความรักล่ะ");
    expect(userPrompt).toContain("ทดสอบ");
    expect(userPrompt).toContain("[natal]");
    expect(userPrompt).toContain("[memory]");
    expect(conversationHistory).toHaveLength(2);
    expect(conversationHistory[0]).toEqual({
      role: "user",
      content: "เรื่องงานเป็นอย่างไร",
    });
    expect(conversationHistory[1]).toEqual({
      role: "assistant",
      content: "งานของคุณมีโอกาสดี",
    });
  });

  it("keeps prior user turns as plain text so trim cannot drop natal from current turn", () => {
    const prior = Array.from({ length: 24 }, (_, i) =>
      i % 2 === 0
        ? { role: "USER" as const, content: `คำถาม-${i}` }
        : { role: "ASSISTANT" as const, content: `คำตอบ-${i}` },
    );
    const { conversationHistory, userPrompt } = buildConversationHistory(
      prior,
      profile,
      chart,
      "คำถามล่าสุด",
      { chartMemory: memory },
    );
    expect(conversationHistory).toHaveLength(20);
    expect(userPrompt).toContain("คำถามล่าสุด");
    expect(userPrompt).toContain("[natal]");
    expect(userPrompt).toContain("[memory]");
    expect(userPrompt).toContain("ทดสอบ");
  });
});
describe("trimConversationHistory", () => {
  it("trims to the most recent turns", () => {
    const long = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg-${i}`,
    }));
    const trimmed = trimConversationHistory(long);
    expect(trimmed).toHaveLength(20);
    expect(trimmed[0].content).toBe("msg-10");
    expect(trimmed[19].content).toBe("msg-29");
  });
});
