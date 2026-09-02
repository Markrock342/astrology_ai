import { describe, expect, it } from "vitest";
import {
  detectMentionedCategories,
  detectQuestionScopeMismatch,
} from "@/lib/question-scope";

describe("question category scope", () => {
  it("routes obvious cross-category questions", () => {
    expect(detectQuestionScopeMismatch("ปีนี้จะมีแฟนไหม", "self")).toBe("love");
    expect(detectQuestionScopeMismatch("หนี้จะหมดเมื่อไร", "self")).toBe("finance");
    expect(detectQuestionScopeMismatch("ควรเปลี่ยนงานไหม", "love")).toBe("career");
  });

  it("allows questions that mention the selected category", () => {
    expect(
      detectQuestionScopeMismatch("นิสัยแบบฉันส่งผลกับความรักอย่างไร", "self"),
    ).toBeNull();
    expect(
      detectQuestionScopeMismatch("งานนี้จะช่วยเพิ่มรายได้ไหม", "career"),
    ).toBeNull();
  });

  it("allows generic questions instead of guessing", () => {
    expect(detectQuestionScopeMismatch("ช่วงนี้เป็นอย่างไรบ้าง", "self")).toBeNull();
  });

  it("names every topic the question clearly mentions", () => {
    expect(detectMentionedCategories("ปีนี้จะมีแฟนไหม")).toEqual(["love"]);
    expect(detectMentionedCategories("งานกับการเงินช่วงนี้")).toEqual(
      expect.arrayContaining(["career", "finance"]),
    );
    expect(detectMentionedCategories("ช่วงนี้เป็นอย่างไรบ้าง")).toEqual([]);
  });
});
