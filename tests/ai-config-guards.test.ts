import { describe, expect, it } from "vitest";
import {
  assertSafeOpenAiBaseUrl,
  isAllowedAiSecretRef,
} from "@/lib/ai-config-guards";
import {
  aiConfigCreateSchema,
  aiConfigTestKeySchema,
  aiConfigUpdateSchema,
} from "@/lib/admin-schemas";
import { suggestedDisplayNameForModel } from "@/config/ai-provider-models";

describe("ai-config-guards", () => {
  it("whitelists only known provider env names", () => {
    expect(isAllowedAiSecretRef("GEMINI_API_KEY")).toBe(true);
    expect(isAllowedAiSecretRef("OPENAI_API_KEY")).toBe(true);
    expect(isAllowedAiSecretRef("DATABASE_URL")).toBe(false);
    expect(isAllowedAiSecretRef("AUTH_SECRET")).toBe(false);
  });

  it("accepts public HTTPS OpenAI-compatible base URLs", () => {
    expect(assertSafeOpenAiBaseUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1",
    );
    expect(assertSafeOpenAiBaseUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("rejects localhost, private, or non-HTTPS base URLs", () => {
    expect(() => assertSafeOpenAiBaseUrl("http://api.openai.com/v1")).toThrow(/HTTPS/);
    expect(() => assertSafeOpenAiBaseUrl("https://localhost/v1")).toThrow(/localhost|ภายใน/);
    expect(() => assertSafeOpenAiBaseUrl("https://127.0.0.1/v1")).toThrow(/localhost|ภายใน/);
    expect(() => assertSafeOpenAiBaseUrl("https://192.168.1.1/v1")).toThrow(/ภายใน/);
    expect(() => assertSafeOpenAiBaseUrl("https://[::1]/v1")).toThrow(/ภายใน/);
    expect(() => assertSafeOpenAiBaseUrl("https://[fc00::1]/v1")).toThrow(/ภายใน/);
    expect(() => assertSafeOpenAiBaseUrl("https://user:pass@api.openai.com/v1")).toThrow(
      /username|password/,
    );
    expect(() =>
      assertSafeOpenAiBaseUrl("https://api.example.com/v1/chat/completions"),
    ).toThrow(/API root/);
    expect(() => assertSafeOpenAiBaseUrl("https://api.example.com/v1?key=x")).toThrow(
      /query string/,
    );
  });
});

describe("AI config create/update schemas", () => {
  it("requires apiKey on create and accepts planScope", () => {
    const parsed = aiConfigCreateSchema.parse({
      provider: "OPENAI",
      modelId: "gpt-5.6",
      displayName: "GPT 5.6",
      apiKey: "sk-test",
      planScope: "PRO",
      baseUrl: "https://api.openai.com/v1",
    });
    expect(parsed.planScope).toBe("PRO");
    expect(parsed.apiKey).toBe("sk-test");
    expect(parsed.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("rejects create without apiKey", () => {
    expect(() =>
      aiConfigCreateSchema.parse({
        provider: "GEMINI",
        modelId: "gemini-3.5-flash",
        displayName: "Flash",
      }),
    ).toThrow();
  });

  it("rejects Gemini create with baseUrl", () => {
    expect(() =>
      aiConfigCreateSchema.parse({
        provider: "GEMINI",
        modelId: "gemini-3.5-flash",
        displayName: "Flash",
        apiKey: "key",
        baseUrl: "https://evil.example/v1",
      }),
    ).toThrow(/OpenAI-compatible/);
  });

  it("rejects arbitrary secretReference names", () => {
    expect(() =>
      aiConfigUpdateSchema.parse({
        secretReference: "DATABASE_URL",
      }),
    ).toThrow();
  });

  it("preserves an omitted Base URL on partial updates", () => {
    const parsed = aiConfigUpdateSchema.parse({ enabled: false });
    expect(parsed).not.toHaveProperty("baseUrl");
  });

  it("rejects private base URL on test-key", () => {
    expect(() =>
      aiConfigTestKeySchema.parse({
        provider: "OPENAI",
        modelId: "gpt-5.6",
        apiKey: "sk-test",
        baseUrl: "https://10.0.0.5/v1",
      }),
    ).toThrow();
  });
});

describe("suggested display names", () => {
  it("builds a label from presets", () => {
    expect(suggestedDisplayNameForModel("GEMINI", "gemini-3.5-flash")).toContain("Gemini");
    expect(suggestedDisplayNameForModel("OPENAI", "gpt-5.6")).toContain("OpenAI");
  });
});
