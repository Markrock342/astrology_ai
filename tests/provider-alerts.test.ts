import { describe, expect, it } from "vitest";
import {
  classifyProviderFailure,
  normalizeGeminiError,
} from "@/server/ai/provider-alerts";

describe("provider-alerts", () => {
  it("classifies billing / credits exhaustion", () => {
    expect(
      classifyProviderFailure(
        "RESOURCE_EXHAUSTED",
        "You exceeded your current quota, please check your plan and billing details",
      ),
    ).toBe("BILLING");
    expect(
      classifyProviderFailure("BILLING_EXHAUSTED", "No credits remaining"),
    ).toBe("BILLING");
  });

  it("classifies rate quota without money words as QUOTA", () => {
    expect(
      classifyProviderFailure("429", "Too many requests — rate limit exceeded"),
    ).toBe("QUOTA");
  });

  it("normalizes Gemini HTTP billing errors", () => {
    const n = normalizeGeminiError({
      httpStatus: 429,
      status: "RESOURCE_EXHAUSTED",
      message: "Prepay credit balance is depleted",
    });
    expect(n.errorCode).toBe("BILLING_EXHAUSTED");
    expect(n.alert).toBe("BILLING");
  });
});
