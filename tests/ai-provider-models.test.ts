import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the DNS-based SSRF egress guard (covered in tests/base-url-egress.test.ts)
// so the adapter test can post to mock endpoints without real resolution.
vi.mock("@/server/ai/base-url-egress", () => ({
  assertBaseUrlEgressAllowed: vi.fn().mockResolvedValue(undefined),
}));

import { aiConfigCreateSchema, aiConfigTestKeySchema } from "@/lib/admin-schemas";
import { modelPresetsForProvider } from "@/config/ai-provider-models";
import { defaultSecretRefForProvider } from "@/lib/ai-config-guards";
import { OpenAIAdapter } from "@/server/ai/providers/openai";

describe("AI provider admin helpers", () => {
  it("uses provider-specific env fallback names", () => {
    expect(defaultSecretRefForProvider("GEMINI")).toBe("GEMINI_API_KEY");
    expect(defaultSecretRefForProvider("OPENAI")).toBe("OPENAI_API_KEY");
  });

  it("has provider-specific model presets", () => {
    expect(modelPresetsForProvider("GEMINI")[0]?.id).toContain("gemini");
    expect(modelPresetsForProvider("OPENAI")[0]?.id).toContain("gpt");
  });
});

describe("AI config schemas", () => {
  it("accepts a valid OpenAI-compatible base URL", () => {
    const parsed = aiConfigCreateSchema.parse({
      provider: "OPENAI",
      modelId: "composer-2.5",
      displayName: "Cursor Composer 2.5",
      baseUrl: "https://api.example.com/v1",
      apiKey: "test-key",
    });
    expect(parsed.baseUrl).toBe("https://api.example.com/v1");
  });

  it("rejects malformed base URLs", () => {
    expect(() =>
      aiConfigTestKeySchema.parse({
        provider: "OPENAI",
        modelId: "gpt-5.6",
        baseUrl: "not-a-url",
        apiKey: "test-key",
      }),
    ).toThrow();
  });
});

describe("OpenAIAdapter baseUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts chat completions to the configured compatible endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "สวัสดี" } }],
        usage: { prompt_tokens: 2, completion_tokens: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAIAdapter().generate({
      modelId: "composer-2.5",
      systemPrompt: "test",
      userPrompt: "hello",
      temperature: 0.2,
      maxOutputTokens: 64,
      timeoutMs: 1000,
      baseUrl: "https://cursor.example.com/v1/",
      apiKey: "test-key",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cursor.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        redirect: "error",
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "composer-2.5",
      max_tokens: 64,
    });
    expect(JSON.parse(String(request.body))).not.toHaveProperty("max_completion_tokens");
  });
});
