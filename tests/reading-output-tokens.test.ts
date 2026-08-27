import { describe, expect, it } from "vitest";
import {
  PRO_MAX_OUTPUT_TOKENS,
  FREE_MAX_OUTPUT_TOKENS,
  BRIEF_MAX_OUTPUT_TOKENS_PRO,
  BRIEF_MAX_OUTPUT_TOKENS_FREE,
  GEMINI_DETAILED_FIRST_TOKEN_MS,
} from "@/config/constants";
import {
  resolveAiTimeoutMs,
  resolveMaxOutputTokens,
} from "@/server/horoscope/reading-service";

describe("resolveMaxOutputTokens", () => {
  it("uses plan cap for detailed mode", () => {
    expect(resolveMaxOutputTokens("PRO", 4096, "detailed")).toBe(
      PRO_MAX_OUTPUT_TOKENS,
    );
    expect(resolveMaxOutputTokens("FREE", 4096, "detailed")).toBe(
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
