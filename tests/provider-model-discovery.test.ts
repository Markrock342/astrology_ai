import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverProviderModels } from "@/server/ai/provider-model-discovery";

describe("provider model discovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists only Gemini models that support generateContent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: "models/gemini-flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/embedding-001",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverProviderModels({
      provider: "GEMINI",
      apiKey: "gemini-key",
    });

    expect(result.ok).toBe(true);
    expect(result.models).toEqual(["gemini-flash"]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1beta/models"),
      expect.objectContaining({
        headers: { "x-goog-api-key": "gemini-key" },
        redirect: "error",
      }),
    );
  });

  it("lists and sorts models from an OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: "model-z" }, { id: "model-a" }, { id: "model-a" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverProviderModels({
      provider: "OPENAI",
      baseUrl: "https://gateway.example/v1/",
      apiKey: "openai-key",
    });

    expect(result.ok).toBe(true);
    expect(result.models).toEqual(["model-a", "model-z"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.example/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer openai-key" },
      }),
    );
  });

  it("returns a provider error without exposing the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "invalid key", code: "AUTH" } }),
      }),
    );

    const result = await discoverProviderModels({
      provider: "OPENAI",
      apiKey: "super-secret",
    });

    expect(result).toMatchObject({
      ok: false,
      models: [],
      errorCode: "AUTH",
      errorMessage: "invalid key",
    });
    expect(JSON.stringify(result)).not.toContain("super-secret");
  });
});
