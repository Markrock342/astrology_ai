import { describe, expect, it } from "vitest";
import { estimateCostUsd, pricingFor } from "@/config/ai-pricing";

describe("pricingFor — provider-aware fallback", () => {
  it("prices known Gemini and OpenAI models from the table", () => {
    expect(pricingFor("gemini-3.5-flash").inputPerMTok).toBe(1.5);
    expect(pricingFor("gpt-4o-mini").inputPerMTok).toBe(0.15);
  });

  it("does NOT price a GPT model with the Gemini fallback", () => {
    // An unknown GPT id must fall back to OpenAI rates, not gemini-3.5-flash
    // ($1.50 in / $9.00 out) — that was a ~10x error in the cost report.
    const p = pricingFor("gpt-4o-2024-11-06");
    expect(p.inputPerMTok).toBe(pricingFor("gpt-4o").inputPerMTok);
    expect(p.inputPerMTok).not.toBe(1.5);
    expect(p.outputPerMTok).not.toBe(9.0);
  });

  it("routes o-series ids to OpenAI pricing", () => {
    expect(pricingFor("o1-mini").inputPerMTok).toBe(pricingFor("gpt-4o").inputPerMTok);
  });

  it("keeps the Gemini fallback for unknown Gemini/other ids", () => {
    expect(pricingFor("gemini-9-ultra").inputPerMTok).toBe(1.5);
  });

  it("estimateCostUsd bills cached tokens as a discounted subset of input", () => {
    // 1M input of which 1M cached, 0 output → all at cached rate (0.15 for flash)
    expect(estimateCostUsd("gemini-3.5-flash", 1_000_000, 0, 1_000_000)).toBeCloseTo(0.15, 5);
    // cached never exceeds input
    expect(estimateCostUsd("gemini-3.5-flash", 100, 0, 999)).toBeCloseTo((100 / 1_000_000) * 0.15, 9);
  });
});
