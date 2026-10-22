import { describe, expect, it } from "vitest";
import { planReading } from "@/lib/reading-plan";
import { questionTopics } from "@/lib/question-topics";

const now = new Date("2026-10-22T05:00:00Z");
const opening = "ตอนนี้งานมาละแต่ไม่ได้ดีลเงินหรือได้รับเงินเลย ลูกค้าเริ่มทยอยหายละ ทักๆมา 5 คนตอนนี้เงียบหมดแล้ว";
const followup = "แล้วจะออกเมื่อไหร่ ทับแม่งอยู่นั้น มาทำเหี้ยไร มันเพิ่งมาไม่ใช่หรอ";
type Message = { role: "USER" | "ASSISTANT"; content: string };

describe("October customer-deal conversation regression", () => {
  it("does not interpret profanity as family, but preserves actual family questions", () => {
    expect(questionTopics(followup)).toEqual([]);
    expect(questionTopics("แม่งลูกค้าเงียบหมด").map((t) => t.label)).toEqual(["ธุรกิจและการค้า"]);
    expect(questionTopics("แม่ผมจะย้ายบ้าน").map((t) => t.label)).toContain("ครอบครัว");
  });

  it("keeps a planetary follow-up in the current financial context", () => {
    const priorMessages: Message[] = [
      { role: "USER", content: opening },
      { role: "ASSISTANT", content: "อาทิตย์จรทับจุดการเงิน" },
    ];
    const result = planReading({ question: followup, priorMessages, now });
    expect(result.basis).toBe("transit");
    expect(result.timelineQuestion).toBeNull();
    expect(result.transitWindow.sampleAt).toEqual(now);
    expect(questionTopics(result.intentQuestion).map((t) => t.label)).toContain("การเงิน");
    expect(questionTopics(result.intentQuestion).map((t) => t.label)).not.toContain("ครอบครัว");
  });

  it("recognizes the user's correction without carrying the false family topic forward", () => {
    const priorMessages: Message[] = [
      { role: "USER", content: opening },
      { role: "USER", content: followup },
      { role: "ASSISTANT", content: "ย้ายบ้านตอนอายุ 25–26 ปี พ.ศ. 2570–2571" },
      { role: "USER", content: "อ้าวแล้วตอนนี้ผม24 แม่งจะอยู่นานเลยหรอ คือลูกค้า 5 คนนี้จะอยู่คุยๆไปถึง 25-26 เลยหรอ" },
    ];
    const result = planReading({ question: "แล้วคุณไปข้ามปีทำไม ผมถามดวงจรช่วงนี้ งงไปหมดแล้ว", priorMessages, now });
    expect(result.correction).toBe(true);
    expect(result.basis).toBe("transit");
    expect(questionTopics(result.intentQuestion).map((t) => t.label)).not.toContain("ครอบครัว");
  });

  it.each(["ดาวอาทิตย์จะย้ายราศีเมื่อไหร่", "เดือนนี้จะออกเมื่อไหร่", "ช่วงนี้จะคล่องตัวเมื่อไหร่"])("does not route short-term timing to life milestones: %s", (question) => {
    expect(planReading({ question, now }).timelineQuestion).toBeNull();
  });

  it("preserves explicit life milestones even after a current financial conversation", () => {
    const result = planReading({ question: "แล้วชีวิตจะมีจุดเปลี่ยนตอนอายุเท่าไหร่", priorMessages: [{ role: "USER", content: opening }], now });
    expect(result.basis).toBe("timeline");
  });

  it("respects an explicitly changed period", () => {
    const result = planReading({ question: "แล้วเดือนหน้าล่ะ", priorMessages: [{ role: "USER", content: opening }], now });
    expect(result.transitWindow.sampleAt.getTime()).toBeGreaterThan(now.getTime());
    expect(result.timelineQuestion).toBeNull();
  });
});
