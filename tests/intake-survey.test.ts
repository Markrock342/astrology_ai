import { describe, expect, it } from "vitest";
import {
  INTAKE_QUESTIONS,
  buildCategoryIntroQuestion,
  formatIntakeForPrompt,
  intakeAnswersSchema,
  isCategoryIntroQuestion,
  type IntakeAnswers,
} from "@/lib/intake-survey";

const sample = {
  focus: ["career", "money"],
  work: ["employee"],
  finance: ["stable"],
  love: "single",
  health: ["none"],
  fortune: "mild",
  strength: ["persist", "think"],
  improve: ["confidence"],
  goal: ["work", "money"],
  style: ["direct"],
} satisfies IntakeAnswers;

describe("intake survey", () => {
  it("has ten questions covering the fortune categories", () => {
    expect(INTAKE_QUESTIONS).toHaveLength(10);
    const cats = new Set(INTAKE_QUESTIONS.map((q) => q.category));
    expect(cats).toEqual(
      new Set(["overview", "career", "finance", "love", "health", "fortune", "self"]),
    );
  });

  it("accepts a complete answers payload", () => {
    expect(intakeAnswersSchema.parse(sample)).toEqual(sample);
  });

  it("upgrades legacy single answers and the old mixed focus value", () => {
    expect(
      intakeAnswersSchema.parse({
        focus: "mixed",
        work: "employee",
        finance: "stable",
        love: "single",
        health: "none",
        fortune: "mild",
        strength: "persist",
        improve: "confidence",
        goal: "work",
        style: "direct",
      }),
    ).toMatchObject({
      focus: ["career", "money", "love", "health", "self"],
      work: ["employee"],
      style: ["direct"],
    });
  });

  it("does not combine an exclusive answer with another selection", () => {
    expect(
      intakeAnswersSchema.safeParse({
        ...sample,
        health: ["none", "sleep"],
      }).success,
    ).toBe(false);
  });

  it("rejects a missing question", () => {
    const rest: Partial<IntakeAnswers> = { ...sample };
    delete rest.focus;
    expect(intakeAnswersSchema.safeParse(rest).success).toBe(false);
  });

  it("formats a prompt block with labels not raw ids", () => {
    const block = formatIntakeForPrompt(sample);
    expect(block).toContain("[intake]");
    expect(block).toContain("ทำงานประจำ");
    expect(block).not.toContain("employee");
  });

  it("marks category-intro questions", () => {
    const q = buildCategoryIntroQuestion("ตัวตน");
    expect(isCategoryIntroQuestion(q)).toBe(true);
    expect(isCategoryIntroQuestion("ช่วงนี้การงานเป็นอย่างไร")).toBe(false);
    expect(q).toContain("ตัวตน");
    expect(q).toContain("ดวงจร");
  });
});
