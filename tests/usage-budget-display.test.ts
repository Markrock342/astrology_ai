import { describe, expect, it } from "vitest";
import { questionsToUnits, thbToUnits, unitsToQuestions, unitsToThb } from "@/lib/usage-budget-display";

// The package form now reads in questions and baht; units are derived.
describe("package budget in words", () => {
  it("reads the current budgets", () => {
    expect(Math.round(unitsToThb(27_778))).toBe(1);
    expect(Math.round(unitsToThb(1_111_111))).toBe(40);
    expect(unitsToQuestions(27_778)).toBeLessThanOrEqual(2);
  });

  it("round-trips questions and baht to units", () => {
    expect(unitsToQuestions(questionsToUnits(8))).toBe(8);
    expect(thbToUnits(5)).toBe(138_889);
  });
});
