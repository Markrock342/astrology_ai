import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateFollowUpMeta,
  sanitizeFollowUpMeta,
} from "@/server/horoscope/follow-up-suggestions";

const generateWithFallbackMock = vi.fn();
const resolveConfigMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/server/ai/router", () => ({
  generateWithFallback: (...args: unknown[]) => generateWithFallbackMock(...args),
  resolveConfig: (...args: unknown[]) => resolveConfigMock(...args),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    aIProviderConfig: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    conversation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    message: {
      count: vi.fn(),
    },
  },
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
    generateWithFallbackMock.mockReset();
    resolveConfigMock.mockReset();
    findManyMock.mockReset();
  });

  it("uses routed config and parses valid JSON", async () => {
    resolveConfigMock.mockResolvedValue({
      id: "cfg-lite",
      provider: "OPENAI",
      modelId: "gpt-lite",
    });
    generateWithFallbackMock.mockResolvedValue({
      ok: true,
      rawText: JSON.stringify({
        summaryLine: "ภาพรวม: การงานดีขึ้น",
        followUps: ["ความรักเป็นอย่างไร", "การเงินช่วงนี้"],
      }),
      modelId: "gpt-lite",
      latencyMs: 100,
      provider: "OPENAI",
    });

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "งานเป็นไง",
      answer: "การงานดีขึ้น",
      categoryName: "การงาน",
      categoryId: "cat-1",
      planScope: "FREE",
    });

    expect(meta.summaryLine).toBe("ภาพรวม: การงานดีขึ้น");
    expect(meta.followUps).toEqual(["ความรักเป็นอย่างไร", "การเงินช่วงนี้"]);
    expect(resolveConfigMock).toHaveBeenCalledWith("cat-1", "FREE", {
      preferFast: true,
    });
    expect(generateWithFallbackMock).toHaveBeenCalledWith(
      "cfg-lite",
      expect.objectContaining({
        maxOutputTokens: 320,
        timeoutMs: 8_000,
      }),
    );
  });

  it("returns empty followUps when model fails", async () => {
    resolveConfigMock.mockResolvedValue({ id: "cfg-1" });
    generateWithFallbackMock.mockResolvedValue({
      ok: false,
      rawText: null,
      modelId: "gemini-lite",
      latencyMs: 50,
      provider: "GEMINI",
    });

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "q",
      answer: "a",
      categoryName: "cat",
      categoryId: "cat-1",
    });

    expect(meta).toEqual({ followUps: [] });
  });

  it("returns empty followUps on malformed JSON", async () => {
    resolveConfigMock.mockResolvedValue({ id: "cfg-1" });
    generateWithFallbackMock.mockResolvedValue({
      ok: true,
      rawText: "not json at all",
      modelId: "gemini-lite",
      latencyMs: 50,
      provider: "GEMINI",
    });

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "q",
      answer: "a",
      categoryName: "cat",
      categoryId: "cat-1",
    });

    expect(meta).toEqual({ followUps: [] });
  });

  it("returns empty followUps when no AI config is available", async () => {
    resolveConfigMock.mockRejectedValue(new Error("No AI config available"));
    findManyMock.mockResolvedValue([]);

    const meta = await generateFollowUpMeta({
      userId: "u1",
      question: "q",
      answer: "a",
      categoryName: "cat",
      categoryId: "cat-1",
    });

    expect(meta).toEqual({ followUps: [] });
    expect(generateWithFallbackMock).not.toHaveBeenCalled();
  });
});
