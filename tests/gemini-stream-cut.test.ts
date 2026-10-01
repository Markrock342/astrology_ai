import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiAdapter } from "@/server/ai/providers/gemini";

function sse(frames: object[]): Response {
  const body = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
  return new Response(new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(body));
      c.close();
    },
  }));
}

const input = {
  modelId: "gemini-3.7-flash",
  apiKey: "test",
  systemPrompt: "s",
  userPrompt: "u",
  temperature: 0.7,
  maxOutputTokens: 4096,
  timeoutMs: 5_000,
} as never;

const text = (t: string) => ({ candidates: [{ content: { parts: [{ text: t }] } }] });

describe("a Gemini stream that ends early", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is flagged as cut by the connection when no finish reason ever came", async () => {
    // What production saw on 1 Oct 2026: text, then the stream simply closed.
    vi.stubGlobal("fetch", vi.fn(async () => sse([text("ตามดาวเจ้าเรือนไปดู **ภพกัมมะ (เรือน")])));
    const r = await new GeminiAdapter().streamGenerate(input, () => {});
    expect(r.ok).toBe(true);
    expect(r.truncated).toBe(true);
    expect(r.truncatedBy).toBe("connection");
  });

  it("is complete when the model reports STOP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      sse([text("คำตอบครบ"), { candidates: [{ content: { parts: [] }, finishReason: "STOP" }], usageMetadata: { candidatesTokenCount: 10 } }]),
    ));
    const r = await new GeminiAdapter().streamGenerate(input, () => {});
    expect(r.truncated).toBe(false);
  });

  it("is cut by the budget on MAX_TOKENS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      sse([text("ยาว"), { candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] }]),
    ));
    const r = await new GeminiAdapter().streamGenerate(input, () => {});
    expect(r.truncatedBy).toBe("budget");
  });
});
