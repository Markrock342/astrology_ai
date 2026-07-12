import { describe, expect, it } from "vitest";
import {
  buildConversationHistory,
  trimConversationHistory,
} from "@/server/ai/prompt-builder";
import type { BirthProfileSnapshot } from "@/types";
import type { ChartJson } from "@/types/chart";

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
  meta: { calculationSource: "formula-pipeline", lagna: "เมษ" },
  planets: [{ planet: "อาทิตย์", siderealSign: "เมษ" }],
  chart: { lagna: "เมษ", taksa: [] },
} as unknown as ChartJson;

describe("buildConversationHistory (M3 B1)", () => {
  it("returns full user prompt when thread is empty", () => {
    const { conversationHistory, userPrompt } = buildConversationHistory(
      [],
      profile,
      null,
      "เรื่องความรักเป็นอย่างไร",
    );
    expect(conversationHistory).toEqual([]);
    expect(userPrompt).toContain("เรื่องความรักเป็นอย่างไร");
    expect(userPrompt).toContain("ทดสอบ");
    expect(userPrompt).toContain("คำถาม:");
  });

  it("attaches profile+chart to every current userPrompt (not only first turn)", () => {
    const { conversationHistory, userPrompt } = buildConversationHistory(
      [
        { role: "USER", content: "เรื่องงานเป็นอย่างไร" },
        { role: "ASSISTANT", content: "งานของคุณมีโอกาสดี" },
      ],
      profile,
      chart,
      "แล้วเรื่องความรักล่ะ",
    );
    expect(userPrompt).toContain("แล้วเรื่องความรักล่ะ");
    expect(userPrompt).toContain("ทดสอบ");
    expect(userPrompt).toContain("[natal]");
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
    );
    expect(conversationHistory).toHaveLength(20);
    expect(userPrompt).toContain("คำถามล่าสุด");
    expect(userPrompt).toContain("[natal]");
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
