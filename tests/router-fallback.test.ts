import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithFallback, resolveConfig } from "@/server/ai/router";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  primaryGenerate: vi.fn(),
  fallbackGenerate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    aIProviderConfig: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/server/ai/providers/gemini", () => ({
  GeminiAdapter: vi.fn().mockImplementation(() => ({
    generate: mocks.primaryGenerate,
    validateModel: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock("@/server/ai/providers/openai", () => ({
  OpenAIAdapter: vi.fn().mockImplementation(function OpenAIAdapter(this: unknown) {
    return {
      generate: mocks.fallbackGenerate,
      validateModel: vi.fn().mockResolvedValue(true),
    };
  }),
}));

vi.mock("@/server/ai/secret-resolver", () => ({
  resolveApiKey: vi.fn().mockResolvedValue("test-api-key"),
  invalidateKeyCache: vi.fn(),
}));

describe("resolveConfig (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers category-specific config over global", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "global",
        categoryId: null,
        planScope: "ALL",
        enabled: true,
      },
      {
        id: "category",
        categoryId: "cat-1",
        planScope: "PRO",
        enabled: true,
      },
    ]);

    const config = await resolveConfig("cat-1", "PRO");
    expect(config.id).toBe("category");
  });

  it("brief mode (preferFast) drops to the lite model over the heavy Pro one", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "pro-heavy",
        categoryId: null,
        planScope: "PRO",
        enabled: true,
        modelId: "gemini-3.5-flash",
      },
      {
        id: "all-lite",
        categoryId: null,
        planScope: "ALL",
        enabled: true,
        modelId: "gemini-3.1-flash-lite",
      },
    ]);

    const brief = await resolveConfig("cat-1", "PRO", { preferFast: true });
    expect(brief.id).toBe("all-lite");

    // Detailed mode keeps the heavy Pro model.
    const detailed = await resolveConfig("cat-1", "PRO");
    expect(detailed.id).toBe("pro-heavy");
  });

  it("preferFast falls back to normal resolution when no lite model exists", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "pro-only",
        categoryId: null,
        planScope: "PRO",
        enabled: true,
        modelId: "gemini-3.5-flash",
      },
    ]);

    const config = await resolveConfig("cat-1", "PRO", { preferFast: true });
    expect(config.id).toBe("pro-only");
  });
});

describe("generateWithFallback (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique
      .mockResolvedValueOnce({
        id: "primary",
        provider: "GEMINI",
        modelId: "gemini-primary",
        temperature: 0.7,
        maxOutputTokens: 100,
        timeoutMs: 1000,
        secretReference: "GEMINI_API_KEY",
        fallbackConfigId: "fallback",
        enabled: true,
      })
      .mockResolvedValueOnce({
        id: "fallback",
        provider: "OPENAI",
        modelId: "gpt-fallback",
        temperature: 0.7,
        maxOutputTokens: 100,
        timeoutMs: 1000,
        secretReference: "OPENAI_API_KEY",
        enabled: true,
      });
    mocks.primaryGenerate.mockResolvedValue({
      ok: false,
      provider: "GEMINI",
      modelId: "gemini-primary",
      latencyMs: 50,
      errorCode: "PROVIDER_ERROR",
    });
    mocks.fallbackGenerate.mockResolvedValue({
      ok: true,
      provider: "OPENAI",
      modelId: "gpt-fallback",
      rawText: "fallback answer",
      latencyMs: 80,
    });
  });

  it("uses fallback config when primary fails", async () => {
    const result = await generateWithFallback("primary", {
      systemPrompt: "sys",
      userPrompt: "user",
    });

    expect(result.ok).toBe(true);
    expect(result.rawText).toBe("fallback answer");
    expect(mocks.primaryGenerate).toHaveBeenCalledOnce();
    expect(mocks.fallbackGenerate).toHaveBeenCalledOnce();
  });
});
