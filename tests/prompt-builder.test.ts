import { describe, expect, it } from "vitest";
import {
  buildConversationHistory,
  trimConversationHistory,
} from "@/server/ai/prompt-builder";
import type { BirthProfileSnapshot } from "@/types";

const profile: BirthProfileSnapshot = {
  nickname: "ทดสอบ",
  birthDate: "1990-01-15T00:00:00.000Z",
  birthTime: "08:30",
  birthTimeKnown: true,
  gender: "หญิง",
  birthLocation: "กรุงเทพฯ",
  additionalInfo: null,
};

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

  it("enriches only the first user turn with birth profile", () => {
    const { conversationHistory, userPrompt } = buildConversationHistory(
      [
        { role: "USER", content: "เรื่องงานเป็นอย่างไร" },
        { role: "ASSISTANT", content: "งานของคุณมีโอกาสดี" },
      ],
      profile,
      null,
      "แล้วเรื่องความรักล่ะ",
    );
    expect(userPrompt).toBe("แล้วเรื่องความรักล่ะ");
    expect(conversationHistory).toHaveLength(2);
    expect(conversationHistory[0].role).toBe("user");
    expect(conversationHistory[0].content).toContain("เรื่องงานเป็นอย่างไร");
    expect(conversationHistory[0].content).toContain("ทดสอบ");
    expect(conversationHistory[1]).toEqual({
      role: "assistant",
      content: "งานของคุณมีโอกาสดี",
    });
  });

  it("keeps follow-up user turns as plain text", () => {
    const { conversationHistory } = buildConversationHistory(
      [
        { role: "USER", content: "คำถามแรก" },
        { role: "ASSISTANT", content: "คำตอบแรก" },
        { role: "USER", content: "คำถามที่สอง" },
        { role: "ASSISTANT", content: "คำตอบที่สอง" },
      ],
      profile,
      null,
      "คำถามที่สาม",
    );
    expect(conversationHistory[2]).toEqual({
      role: "user",
      content: "คำถามที่สอง",
    });
    expect(conversationHistory[2].content).not.toContain("ข้อมูลผู้ถาม");
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
