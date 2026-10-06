import { describe, expect, it } from "vitest";
import { formatQuestionFocus, topicHousesOf } from "@/lib/question-topics";

// Graders: a question about a home reasoned from ภพ 1 or ลาภะ instead of ภพ 4.
describe("the houses a question is about", () => {
  it.each([
    ["อาทิตย์นี้ย้ายบ้านดีไหม", [4]],
    ["ปีหน้าจะได้ไปต่างประเทศไหม", [9]],
    ["เดือนนี้เรื่องความรักเป็นยังไง", [7, 5]],
    ["งานใหม่จะได้ไหม", [10, 6]],
  ])("%s", (q, houses) => expect(topicHousesOf(q)).toEqual(houses));

  it("names the house and its lord for the model", () => {
    expect(formatQuestionFocus("ซื้อบ้านปีนี้ดีไหม", "กันย์")).toContain("ภพ 4 พันธุ (ราศีธนู เจ้าเรือนพฤหัสบดี)");
  });
});
