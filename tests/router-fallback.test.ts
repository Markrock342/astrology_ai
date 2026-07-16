import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateOnce,
  generateWithFallback,
  resolveConfig,
} from "@/server/ai/router";

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

const t0 = new Date("2026-01-01T00:00:00Z");
const t1 = new Date("2026-06-01T00:00:00Z");

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
        updatedAt: t0,
      },
      {
        id: "category",
        categoryId: "cat-1",
        planScope: "PRO",
        enabled: true,
        updatedAt: t0,
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
        updatedAt: t1,
      },
      {
        id: "all-lite",
        categoryId: null,
        planScope: "ALL",
        enabled: true,
        modelId: "gemini-3.1-flash-lite",
        updatedAt: t0,
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
        updatedAt: t0,
      },
    ]);

    const config = await resolveConfig("cat-1", "PRO", { preferFast: true });
    expect(config.id).toBe("pro-only");
  });

  it("tie-breaks equal scores by newer updatedAt then id", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "older-all",
        categoryId: null,
        planScope: "ALL",
        enabled: true,
        modelId: "gemini-a",
        updatedAt: t0,
      },
      {
        id: "newer-all",
        categoryId: null,
        planScope: "ALL",
        enabled: true,
        modelId: "gemini-b",
        updatedAt: t1,
      },
    ]);

    const config = await resolveConfig("cat-1", "FREE");
    expect(config.id).toBe("newer-all");
  });
});

const primaryRow = {
  id: "primary",
  provider: "GEMINI",
  modelId: "gemini-primary",
  temperature: 0.7,
  maxOutputTokens: 100,
  timeoutMs: 1000,
  baseUrl: null,
  encryptedApiKey: null,
  secretReference: "GEMINI_API_KEY",
  fallbackConfigId: "fallback",
  enabled: true,
};

const fallbackRow = {
  id: "fallback",
  provider: "OPENAI",
  modelId: "gpt-fallback",
  temperature: 0.7,
  maxOutputTokens: 100,
  timeoutMs: 1000,
  baseUrl: "https://example.test/v1",
  encryptedApiKey: null,
  secretReference: "OPENAI_API_KEY",
  enabled: true,
  fallbackConfigId: null,
};

describe("generateWithFallback (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "primary") return primaryRow;
      if (where.id === "fallback") return fallbackRow;
      return null;
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

describe("generateOnce (health/test)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(primaryRow);
    mocks.primaryGenerate.mockResolvedValue({
      ok: false,
      provider: "GEMINI",
      modelId: "gemini-primary",
      latencyMs: 50,
      errorCode: "PROVIDER_ERROR",
    });
  });

  it("does not call fallback when primary fails", async () => {
    const result = await generateOnce("primary", {
      systemPrompt: "sys",
      userPrompt: "user",
    });

    expect(result.ok).toBe(false);
    expect(result.modelId).toBe("gemini-primary");
    expect(mocks.primaryGenerate).toHaveBeenCalledOnce();
    expect(mocks.fallbackGenerate).not.toHaveBeenCalled();
  });
});
