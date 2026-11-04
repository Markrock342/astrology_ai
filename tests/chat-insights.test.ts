import { describe, expect, it } from "vitest";
import { combineInsightGroups, INSIGHT_OTHER, insightSystemPrompt, mergeInsightLabels, redactInsightText, specificInsightLabel, topInsights } from "@/lib/chat-insights";
describe("privacy-preserving chat insights", () => {
  it("requires actual question/answer templates rather than the observed broad topic headings", () => {
    expect(specificInsightLabel("ดวงการงาน อาชีพ และการศึกษา", "USER")).toBe(false);
    expect(specificInsightLabel("ดวงชะตาการเงิน โชคลาภ และหนี้สิน", "ASSISTANT")).toBe(false);
    expect(specificInsightLabel("ควรเปลี่ยนงานเมื่อไหร่?", "USER")).toBe(true);
    expect(specificInsightLabel("ทำไมความสัมพันธ์จึงไม่ราบรื่น?".normalize("NFKC"), "USER")).toBe(true);
    expect(specificInsightLabel("ควรเตรียมทักษะและเงินสำรองก่อนเปลี่ยนงาน", "ASSISTANT")).toBe(true);
    expect(specificInsightLabel("ไม่สามารถอ่านดวงนวางค์ได้เมื่อไม่มีข้อมูลตำแหน่งดาว", "ASSISTANT")).toBe(true);
    expect(insightSystemPrompt("USER")).toContain("never collapse");
  });
  it("retains 80 distinct intents in a batch and excludes smalltalk before selecting the top 50", () => {
    const source = Array.from({ length: 80 }, (_, i) => ({ label: `ควรถามหัวข้อ ${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)} อย่างไร?`, count: 1, members: new Set(["a", "b", "c"]) }));
    const result = combineInsightGroups(JSON.stringify({ groups: source.map((g, id) => ({ label: g.label, ids: [id] })) }), source, []);
    expect(result).toHaveLength(80); expect(new Set(result.map(g => g.label)).size).toBe(80);
    const top = topInsights([...result, { label: INSIGHT_OTHER, count: 100, members: new Set(["a", "b", "c"]) }]);
    expect(top).toHaveLength(50); expect(top.some(g => g.label === INSIGHT_OTHER)).toBe(false);
  });
  it("redacts known identities, email, phone, dates and URLs before processing", () => {
    const result = redactInsightText("ผม สมชาย ใจดี test@example.com โทร 081-234-5678 เกิด 04/11/2026 https://example.com/user", ["สมชาย ใจดี"]);
    for (const raw of ["สมชาย", "test@example.com", "081", "04/11", "example.com"]) expect(result).not.toContain(raw);
    expect(redactInsightText("ช่วยทำนายเรื่องงาน", [])).toBe("ช่วยทำนายเรื่องงาน".normalize("NFKC"));
  });
  it("counts verified source IDs and suppresses groups from fewer than 3 distinct members", () => {
    const source = ["one", "two", "three"].map(id => ({ label: "เปลี่ยนงาน", count: 2, members: new Set([id]) }));
    const combined = combineInsightGroups(JSON.stringify({ groups: [{ label: "ควรเปลี่ยนงานช่วงไหน", ids: [0, 1, 2] }] }), source, []);
    expect(topInsights(combined)).toEqual([{ label: "ควรเปลี่ยนงานช่วงไหน", count: 6 }]);
    expect(topInsights(source)).toEqual([]);
    expect(topInsights([{ ...combined[0], members: new Set(["only-one"]) }])).toEqual([]);
  });
  it("merges identical labels across retries while preserving counts and unique-member privacy", () => {
    const merged = mergeInsightLabels([
      { label: "เรื่องงาน", count: 2, members: new Set(["a", "b"]) },
      { label: "เรื่องงาน", count: 3, members: new Set(["b", "c"]) },
    ]);
    expect(merged).toHaveLength(1); expect(merged[0].members.size).toBe(3);
    expect(topInsights(merged)).toEqual([{ label: "เรื่องงาน", count: 5 }]);
  });
  it("rejects hallucinated, duplicate and missing IDs rather than displaying invented counts", () => {
    const source = [{ label: "งาน", count: 1, members: new Set(["one"]) }];
    for (const ids of [[2], [0, 0]]) expect(() => combineInsightGroups(JSON.stringify({ groups: [{ label: "เรื่องงาน", ids }] }), source, [])).toThrow();
    expect(() => combineInsightGroups('{"groups":[]}', source, [])).toThrow();
    expect(() => combineInsightGroups('{"groups":[{"label":"เรื่องงาน","ids":[0]}]}', [...source, ...source], [])).toThrow("Incomplete");
  });
});
