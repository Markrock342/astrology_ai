import { describe, expect, it } from "vitest";
import { eventTone } from "@/lib/life-timeline";

describe("eventTone", () => {
  it("leans by planet and the year's ทักษา", () => {
    expect(eventTone("พฤหัสบดี", "ศรีจร")).toBe("หนุน");
    expect(eventTone("เสาร์", "กาลกิณีจร")).toBe("กดดัน");
    expect(eventTone("เสาร์", "ศรีจร")).toBe("ผสม");
  });
});
