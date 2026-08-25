import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_BRIEF_MODEL_ID,
  DEFAULT_GEMINI_MODEL_ID,
  briefGeminiRank,
  gemini3ThinkingLevel,
  geminiReplacementHint,
  isBriefGeminiModel,
  isDetailedGeminiModel,
} from "@/config/gemini-models";

describe("gemini model routing helpers", () => {
  it("treats 3.5 Flash as brief and 3.7 Flash as detailed", () => {
    expect(isBriefGeminiModel(DEFAULT_GEMINI_BRIEF_MODEL_ID)).toBe(true);
    expect(isBriefGeminiModel("gemini-3.5-flash-lite")).toBe(true);
    expect(isBriefGeminiModel(DEFAULT_GEMINI_MODEL_ID)).toBe(false);

    expect(isDetailedGeminiModel(DEFAULT_GEMINI_MODEL_ID)).toBe(true);
    expect(isDetailedGeminiModel("gemini-3.6-flash")).toBe(true);
    expect(isDetailedGeminiModel(DEFAULT_GEMINI_BRIEF_MODEL_ID)).toBe(false);
  });

  it("ranks 3.5 Flash above lite for brief mode", () => {
    expect(briefGeminiRank("gemini-3.5-flash")).toBeGreaterThan(
      briefGeminiRank("gemini-3.5-flash-lite"),
    );
  });

  it("uses LOW thinking on 3.7 (MINIMAL is rejected by Google)", () => {
    expect(gemini3ThinkingLevel("gemini-3.7-flash")).toBe("LOW");
    expect(gemini3ThinkingLevel("gemini-3.5-flash")).toBe("MINIMAL");
    expect(gemini3ThinkingLevel("gemini-3.5-flash-lite")).toBe("MINIMAL");
  });

  it("nudges admins off 3.6 Flash", () => {
    expect(geminiReplacementHint("gemini-3.6-flash")).toContain("gemini-3.7-flash");
  });
});
