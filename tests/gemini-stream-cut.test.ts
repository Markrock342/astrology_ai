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

describe("resuming a dropped stream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("picks up where Gemini stopped and finishes the answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sse([text("ในเดือนตุลาคมนี้ มีเกณฑ์ชัดเจนที่จะได้ข้อสรุปเรื่อง")]))
      .mockResolvedValueOnce(
        sse([text("งานใหม่ในวันศุกร์ที่ 9"), { candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const seen: string[] = [];
    const r = await new GeminiAdapter().streamGenerate(input, (c) => seen.push(c));
    expect(r.truncated).toBe(false);
    expect(r.rawText).toBe("ในเดือนตุลาคมนี้ มีเกณฑ์ชัดเจนที่จะได้ข้อสรุปเรื่องงานใหม่ในวันศุกร์ที่ 9");
    expect(seen.join("")).toBe(r.rawText);
    // The resume carries the text so far as the model's turn.
    const body = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(body.contents.at(-2)).toEqual({ role: "model", parts: [{ text: "ในเดือนตุลาคมนี้ มีเกณฑ์ชัดเจนที่จะได้ข้อสรุปเรื่อง" }] });
  });

  it("does not resume an answer cut by the output budget", async () => {
    const fetchMock = vi.fn(async () =>
      sse([text("ยาว"), { candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    await new GeminiAdapter().streamGenerate(input, () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the text and resumes when the socket resets mid-answer", async () => {
    // QA 2026-10-04: undici raises TypeError("terminated") on a reset; the
    // answer already on screen was saved as FAILED.
    let pulls = 0;
    const reset = new Response(new ReadableStream({
      pull(c) {
        if (pulls++ === 0) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(text("ครึ่งแรก"))}\n\n`));
        else c.error(new TypeError("terminated"));
      },
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reset)
      .mockResolvedValueOnce(sse([text("ครึ่งหลัง"), { candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }]));
    vi.stubGlobal("fetch", fetchMock);
    const r = await new GeminiAdapter().streamGenerate(input, () => {});
    expect(r.ok).toBe(true);
    expect(r.rawText).toBe("ครึ่งแรกครึ่งหลัง");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads a final frame that has no trailing newline", async () => {
    const raw = `data: ${JSON.stringify(text("ครบ"))}\n\ndata: ${JSON.stringify({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] })}`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(raw)));
    const r = await new GeminiAdapter().streamGenerate(input, () => {});
    expect(r.truncated).toBe(false);
  });
});
