import { describe, expect, it } from "vitest";
import {
  PRO_MAX_OUTPUT_TOKENS,
  FREE_MAX_OUTPUT_TOKENS,
  BRIEF_MAX_OUTPUT_TOKENS_PRO,
  BRIEF_MAX_OUTPUT_TOKENS_FREE,
  GEMINI_DETAILED_FIRST_TOKEN_MS,
  PRO_OVERVIEW_MAX_OUTPUT_TOKENS,
  FREE_OVERVIEW_MAX_OUTPUT_TOKENS,
} from "@/config/constants";
import {
  resolveAiTimeoutMs,
  resolveMaxOutputTokens,
} from "@/server/horoscope/reading-service";

describe("resolveMaxOutputTokens", () => {
  it("uses plan cap for detailed mode", () => {
    // An admin ceiling above the plan cap, so the plan cap is what shows.
    expect(resolveMaxOutputTokens("PRO", 16_384, "detailed")).toBe(
      PRO_MAX_OUTPUT_TOKENS,
    );
    expect(resolveMaxOutputTokens("FREE", 16_384, "detailed")).toBe(
      FREE_MAX_OUTPUT_TOKENS,
    );
  });

  it("uses lower brief cap for brief mode", () => {
    expect(resolveMaxOutputTokens("PRO", 4096, "brief")).toBe(
      BRIEF_MAX_OUTPUT_TOKENS_PRO,
    );
    expect(resolveMaxOutputTokens("FREE", 4096, "brief")).toBe(
      BRIEF_MAX_OUTPUT_TOKENS_FREE,
    );
    expect(resolveMaxOutputTokens("PRO", 4096, "brief")).toBeLessThan(
      resolveMaxOutputTokens("PRO", 4096, "detailed"),
    );
    expect(resolveMaxOutputTokens("FREE", 4096, "brief")).toBeLessThan(
      resolveMaxOutputTokens("FREE", 4096, "detailed"),
    );
  });

  it("gives a 17-topic overview room to finish", () => {
    expect(resolveMaxOutputTokens("PRO", 16_384, "detailed", true)).toBe(
      PRO_OVERVIEW_MAX_OUTPUT_TOKENS,
    );
    expect(resolveMaxOutputTokens("FREE", 16_384, "detailed", true)).toBe(
      FREE_OVERVIEW_MAX_OUTPUT_TOKENS,
    );
    // Brief stays brief, and the admin's per-model ceiling still wins.
    expect(resolveMaxOutputTokens("PRO", 16_384, "brief", true)).toBe(
      BRIEF_MAX_OUTPUT_TOKENS_PRO,
    );
    expect(resolveMaxOutputTokens("PRO", 4096, "detailed", true)).toBe(4096);
  });

  it("respects admin config ceiling below plan cap", () => {
    expect(resolveMaxOutputTokens("PRO", 256, "detailed")).toBe(256);
    expect(resolveMaxOutputTokens("PRO", 256, "brief")).toBe(256);
  });

  it("defaults to detailed when answerMode omitted", () => {
    expect(resolveMaxOutputTokens("PRO", 2048)).toBe(2048);
    expect(resolveMaxOutputTokens("PRO", 8192, "detailed")).toBe(
      PRO_MAX_OUTPUT_TOKENS,
    );
  });
});

describe("resolveAiTimeoutMs", () => {
  it("waits longer for Gemini 3.7 detailed thinking", () => {
    expect(
      resolveAiTimeoutMs("gemini-3.7-flash", 45_000, "detailed"),
    ).toBe(GEMINI_DETAILED_FIRST_TOKEN_MS);
  });

  it("keeps the admin timeout for brief mode and non-3.7 models", () => {
    expect(resolveAiTimeoutMs("gemini-3.7-flash", 45_000, "brief")).toBe(45_000);
    expect(resolveAiTimeoutMs("gemini-3.5-flash", 30_000, "detailed")).toBe(
      30_000,
    );
  });
});

describe("detailed answers are long enough for the reading method", () => {
  it("asks a single topic for depth in a few sections, with a closing table", async () => {
    const c = await import("@/config/constants");
    // One answer mode since 8 Oct 2026: ~900 words read as "อธิบายเยอะ".
    expect(c.PRO_DETAILED_WORDS_MIN).toBe(400);
    expect(c.PRO_DETAILED_WORDS_MAX).toBe(550);
    expect(c.DETAILED_ANSWER_HINT_PRO).toContain("2–3 ส่วนด้วย ##");
    expect(c.DETAILED_ANSWER_HINT_PRO).toContain("### ดาวที่เกี่ยวข้องกับเรื่องนี้");
    // The old hint forbade tables outright and capped the answer at 500 words.
    expect(c.DETAILED_ANSWER_HINT_PRO).not.toContain("350–500");
  });

  it("gives an overview a per-topic target instead of the single-topic total", async () => {
    const c = await import("@/config/constants");
    expect(c.OVERVIEW_ANSWER_HINT_PRO).toContain("ไล่ครบ 17 หัวข้อ");
    expect(c.OVERVIEW_ANSWER_HINT_PRO).toContain("หัวข้อละประมาณ 150–220 คำ");
  });
});
