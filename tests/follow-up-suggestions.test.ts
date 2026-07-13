import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  generateFollowUpMeta,
  sanitizeFollowUpMeta,
} from "@/server/horoscope/follow-up-suggestions";

const generateMock = vi.fn();

vi.mock("@/server/ai/providers/gemini", () => ({
  GeminiAdapter: vi.fn().mockImplementation(() => ({
    generate: generateMock,
  })),
}));

vi.mock("@/server/ai/usage-logger", () => ({
  logUsage: vi.fn().mockResolvedValue(undefined),
}));

describe("sanitizeFollowUpMeta", () => {
  it("truncates summary and follow-ups to contract limits", () => {
    const long = "ก".repeat(200);
    const meta = sanitizeFollowUpMeta({
      summaryLine: long,
      followUps: [long, long, long, long],
    });
    expect(meta.summaryLine?.length).toBe(120);
    expect(meta.followUps).toHaveLength(3);
    expect(meta.followUps[0]?.length).toBe(60);
  });

  it("returns empty followUps for invalid input", () => {
    expect(sanitizeFollowUpMeta(null)).toEqual({ followUps: [] });
    expect(sanitizeFollowUpMeta({ followUps: "bad" })).toEqual({ followUps: [] });
  });
});

describe("generateFollowUpMeta", () => {
  beforeEach(() => {
    generateMock.mockReset();
  });

  it("parses valid JSON from Flash-Lite", async () => {
    generateMock.mockResolvedValue({
      ok: true,
      rawText: JSON.stringify({
        summaryLine: "ภาพรวม: การงานดีขึ้น",
        followUps: ["ความรักเป็นอย่างไร", "การเงินช่วงนี้"],
      }),
      modelId: "gemini-3.1-flash-lite",
      latencyMs: 100,
      provider: "GEMINI",
    });

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "งานเป็นไง",
      answer: "การงานดีขึ้น",
      categoryName: "การงาน",
    });

    expect(meta.summaryLine).toBe("ภาพรวม: การงานดีขึ้น");
    expect(meta.followUps).toEqual(["ความรักเป็นอย่างไร", "การเงินช่วงนี้"]);
  });

  it("returns empty followUps when model fails", async () => {
    generateMock.mockResolvedValue({
      ok: false,
      rawText: null,
      modelId: "gemini-3.1-flash-lite",
      latencyMs: 50,
      provider: "GEMINI",
    });

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "q",
      answer: "a",
      categoryName: "cat",
    });

    expect(meta).toEqual({ followUps: [] });
  });

  it("returns empty followUps on malformed JSON", async () => {
    generateMock.mockResolvedValue({
      ok: true,
      rawText: "not json at all",
      modelId: "gemini-3.1-flash-lite",
      latencyMs: 50,
      provider: "GEMINI",
    });

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "q",
      answer: "a",
      categoryName: "cat",
    });

    expect(meta).toEqual({ followUps: [] });
  });
});
