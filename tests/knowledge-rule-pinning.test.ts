import { describe, expect, it } from "vitest";
import { retrieveKnowledgeChunks } from "@/server/horoscope/knowledge-retrieval";

// A crowded corpus, like a real one: forty career passages that all match a
// career question, and one short passage that defines the planet pairs and a
// special pattern — which the question never mentions.
const careerPages = Array.from({ length: 40 }, (_, i) => ({
  id: `career-${i}`,
  title: `การงาน บทที่ ${i + 1}`,
  content: `การงานและอาชีพ เรือนกัมมะ ดาวเจ้าเรือนกัมมะ ความก้าวหน้าในการงาน ปีนี้ `.repeat(28),
  sortOrder: i,
}));
const rules = {
  id: "rules",
  title: "ดาวคู่และรูปดวงพิเศษ",
  content:
    "ดาวคู่: คู่มิตร คู่ธาตุ คู่สมพล คู่ศัตรู แต่ละคู่ให้ผลต่างกันเมื่อกุมหรือเล็งกัน " +
    "รูปดวงพิเศษ: มาลัยโยค เมื่อดาวเรียงกันต่อเนื่อง ดอกพิกุล และจตุสดัย มีเงื่อนไขเฉพาะ",
  sortOrder: 99,
};

describe("rule definitions reach the AI in a crowded corpus", () => {
  const picked = retrieveKnowledgeChunks([...careerPages, rules], {
    query: "การงานปีนี้เป็นยังไง",
    maxChars: 28_000,
  });

  it("sends the planet-pair and special-pattern passage on a question that never names them", () => {
    const rule = picked.find((c) => c.documentId === "rules");
    expect(rule).toBeDefined();
    expect(rule?.pinned).toBe(true);
  });

  it("still gives most of the budget to what the question is about", () => {
    const career = picked.filter((c) => c.documentId.startsWith("career"));
    const careerChars = career.reduce((n, c) => n + c.content.length, 0);
    expect(career.length).toBeGreaterThan(5);
    expect(careerChars).toBeGreaterThan(28_000 * 0.6);
  });

  it("keeps rule passages inside their share, never the whole budget", () => {
    const ruleHeavy = Array.from({ length: 30 }, (_, i) => ({
      id: `rule-${i}`,
      title: `ดาวคู่ ตอนที่ ${i + 1}`,
      content: "คู่มิตร คู่ธาตุ คู่สมพล คู่ศัตรู ".repeat(120),
      sortOrder: 100 + i,
    }));
    const mixed = retrieveKnowledgeChunks([...careerPages, ...ruleHeavy], {
      query: "การงานปีนี้เป็นยังไง",
      maxChars: 28_000,
    });
    const pinnedChars = mixed
      .filter((c) => c.pinned)
      .reduce((n, c) => n + c.content.length, 0);
    expect(pinnedChars).toBeLessThanOrEqual(28_000 * 0.3);
    expect(mixed.some((c) => c.documentId.startsWith("career"))).toBe(true);
  });
});
