import { describe, expect, it } from "vitest";
import { geminiVisibleText } from "@/server/ai/providers/gemini";
import {
  DEFAULT_GEMINI_BRIEF_MODEL_ID,
  DEFAULT_GEMINI_MODEL_ID,
  gemini3ThinkingLevel,
  geminiReplacementHint,
  isDetailedGeminiModel,
  isGeminiLiteModel,
} from "@/config/gemini-models";
import { briefTurnCostUsd } from "@/config/ai-pricing";

describe("gemini model routing helpers", () => {
  it("treats 3.7 Flash as detailed and spots lite models", () => {
    expect(isGeminiLiteModel("gemini-3.5-flash-lite")).toBe(true);
    expect(isGeminiLiteModel("gemini-3.5-flash")).toBe(false);
    expect(isGeminiLiteModel(DEFAULT_GEMINI_MODEL_ID)).toBe(false);

    expect(isDetailedGeminiModel(DEFAULT_GEMINI_MODEL_ID)).toBe(true);
    expect(isDetailedGeminiModel("gemini-3.6-flash")).toBe(true);
    expect(isDetailedGeminiModel(DEFAULT_GEMINI_BRIEF_MODEL_ID)).toBe(false);
  });

  it("prices a กระชับ turn on 3.7 Flash below 3.5 Flash", () => {
    // Regression: กระชับ used to route to 3.5 Flash by name. It bills $1.50 in
    // / $9.00 out per 1M against 3.7 Flash's $0.75 / $3.75, and the prompt is
    // the same in both modes — so กระชับ burned more usage than ละเอียด.
    expect(briefTurnCostUsd("gemini-3.7-flash")).toBeLessThan(
      briefTurnCostUsd(DEFAULT_GEMINI_BRIEF_MODEL_ID),
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

describe("geminiVisibleText", () => {
  it("drops thought parts and keeps answer text", () => {
    expect(
      geminiVisibleText([
        { thought: true, text: "internal reasoning" },
        { text: "คำทำนาย" },
        { thought: true, text: "more thinking" },
      ]),
    ).toBe("คำทำนาย");
  });
});
