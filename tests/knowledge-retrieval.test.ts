import { describe, expect, it } from "vitest";
import {
  buildKnowledgePrompt,
  chunkKnowledgeDocuments,
  retrieveKnowledgeChunks,
} from "@/server/horoscope/knowledge-retrieval";

describe("knowledge retrieval", () => {
  it("splits a large source into bounded overlapping candidates", () => {
    const chunks = chunkKnowledgeDocuments([
      { id: "large", title: "ตำรา", content: "ดาวศุกร์ ความรัก ".repeat(500) },
    ]);

    expect(chunks.length).toBeGreaterThan(2);
    expect(Math.max(...chunks.map((chunk) => chunk.content.length))).toBeLessThanOrEqual(
      2_400,
    );
    expect(chunks.every((chunk) => chunk.documentId === "large")).toBe(true);
  });

  it("retrieves the relevant Thai section even when it is later in sort order", () => {
    const selected = retrieveKnowledgeChunks(
      [
        {
          id: "career",
          title: "การงาน",
          content: "อาชีพ ความก้าวหน้า ผู้ใหญ่สนับสนุน ".repeat(40),
          sortOrder: 1,
        },
        {
          id: "love",
          title: "ความหมายดาวศุกร์ด้านความรัก",
          content: "คู่ครอง ความสัมพันธ์ ความรัก การพบเจอคู่ ".repeat(40),
          sortOrder: 99,
        },
      ],
      { query: "ความรักและลักษณะคู่ครองเป็นอย่างไร", maxChars: 1_800 },
    );

    expect(selected[0]?.documentId).toBe("love");
    expect(selected.some((chunk) => chunk.documentId === "career")).toBe(false);
  });

  it("uses chart context to resolve a short follow-up", () => {
    const selected = retrieveKnowledgeChunks(
      [
        { id: "mars", title: "ดาวอังคาร", content: "อังคาร นักรบ ความกล้า" },
        { id: "venus", title: "ดาวศุกร์", content: "ศุกร์ ความรัก สุนทรียภาพ" },
      ],
      {
        query: "แล้วปีหน้าล่ะ",
        context: "หมวดความรัก ดาวศุกร์กุมลัคนา",
        maxChars: 1_000,
      },
    );

    expect(selected[0]?.documentId).toBe("venus");
  });

  it("keeps the final prompt inside its character budget", () => {
    const prompt = buildKnowledgePrompt(
      [
        { id: "a", title: "A", content: "การเงิน รายได้ ".repeat(1_000) },
        { id: "b", title: "B", content: "การเงิน รายจ่าย ".repeat(1_000) },
      ],
      { query: "การเงิน", maxChars: 5_000 },
    );

    expect(prompt).toBeTruthy();
    expect(prompt!.length).toBeLessThanOrEqual(5_000);
  });

  it("removes internal provider and retrieval implementation terms", () => {
    const prompt = buildKnowledgePrompt(
      [
        {
          title: "แนว MyHora.com",
          content: "ข้อมูลจาก myhora scrape และ fallback ภายใน",
        },
      ],
      { query: "หลักโหราศาสตร์" },
    );

    expect(prompt).not.toMatch(/myhora|scrape|fallback/i);
    expect(prompt).toContain("หลักโหราศาสตร์ไทย");
  });
});
