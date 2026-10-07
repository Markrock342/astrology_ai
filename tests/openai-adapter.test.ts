import { afterEach, describe, expect, it, vi } from "vitest";
import { isReasoningModel, OpenAIAdapter, rejectedParam } from "@/server/ai/providers/openai";

const base = {
  modelId: "gpt-6-luna",
  systemPrompt: "s",
  userPrompt: "u",
  temperature: 0.7,
  maxOutputTokens: 100,
  timeoutMs: 5000,
  apiKey: "sk-test",
};

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI model quirks", () => {
  it("treats gpt-5 and later as reasoning models", () => {
    for (const id of ["gpt-5", "gpt-5.6-luna", "gpt-6-luna", "o3-mini"]) expect(isReasoningModel(id), id).toBe(true);
    for (const id of ["gpt-4o", "gpt-4.1-mini"]) expect(isReasoningModel(id), id).toBe(false);
  });
  it("reads which parameter a 400 rejected", () => {
    expect(rejectedParam({ message: "Unsupported value: 'temperature' does not support 0.7 with this model.", code: "unsupported_value" })).toBe("temperature");
    expect(rejectedParam({ param: "reasoning_effort", message: "x" })).toBe("reasoning_effort");
    expect(rejectedParam({ message: "Incorrect API key" })).toBeNull();
  });
});

describe("OpenAIAdapter.generate", () => {
  it("retries without a parameter the model rejected", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(body);
      if ("reasoning_effort" in body) {
        return new Response(JSON.stringify({ error: { message: "Unsupported parameter: 'reasoning_effort'", param: "reasoning_effort" } }), { status: 400 });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "ตอบค่ะ" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 3 } }), { status: 200 });
    }));
    const r = await new OpenAIAdapter().generate(base as never);
    expect(r.ok).toBe(true);
    expect(r.rawText).toBe("ตอบค่ะ");
    expect(bodies).toHaveLength(2);
    expect("temperature" in bodies[0]!).toBe(false);
    expect("reasoning_effort" in bodies[1]!).toBe(false);
  });
});

describe("OpenAIAdapter.streamGenerate", () => {
  it("streams deltas and reads usage from the last chunk", async () => {
    const sse = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "สวัส" } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "ดีค่ะ" }, finish_reason: "stop" }] })}`,
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 4 } })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const deltas: string[] = [];
    const r = await new OpenAIAdapter().streamGenerate(base as never, (d) => deltas.push(d));
    expect(deltas).toEqual(["สวัส", "ดีค่ะ"]);
    expect(r.ok).toBe(true);
    expect(r.rawText).toBe("สวัสดีค่ะ");
    expect(r.usage).toMatchObject({ inputTokens: 20, outputTokens: 4 });
    expect(r.truncated).toBeUndefined();
  });
  it("marks a stream that ends without a finish reason as cut", async () => {
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: "ครึ่ง" } }] })}\n`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(sse, { status: 200 })));
    const r = await new OpenAIAdapter().streamGenerate(base as never, () => {});
    expect(r.truncatedBy).toBe("connection");
  });
});
