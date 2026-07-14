import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult, HoroscopeResponse } from "@/types";
import { resolveSecret } from "@/config/env";
import { normalizeGeminiError } from "@/server/ai/provider-alerts";

type GeminiApiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code?: number; message?: string; status?: string };
};

/** Best-effort parse; horoscope output may be plain Thai prose if JSON parse fails. */
function parseHoroscopeText(raw: string): HoroscopeResponse | undefined {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return undefined;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as HoroscopeResponse;
    if (parsed.title && parsed.summary) return parsed;
  } catch {
    /* fall through */
  }
  return undefined;
}

/** Gemini 3.x uses thinkingLevel; 2.5 uses thinkingBudget — never both. */
function buildGenerationConfig(input: GenerateAIInput) {
  const config: Record<string, unknown> = {
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
  };
  const id = input.modelId.toLowerCase();
  if (id.includes("gemini-3")) {
    config.thinkingConfig = { thinkingLevel: "MINIMAL" };
  } else if (id.includes("gemini-2.5")) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
  return config;
}

function buildContents(input: GenerateAIInput) {
  const historyContents = (input.conversationHistory ?? []).map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
  return [
    ...historyContents,
    { role: "user", parts: [{ text: input.userPrompt }] },
  ];
}

/**
 * Gemini REST adapter (server-only). Model id comes from Admin CMS.
 * Never throws; returns ok:false on errors.
 */
export class GeminiAdapter implements AIProviderAdapter {
  async generate(input: GenerateAIInput): Promise<GenerateAIResult> {
    const start = Date.now();
    const apiKey = resolveSecret(input.secretReference);

    if (!apiKey) {
      return {
        ok: false,
        provider: "GEMINI",
        modelId: input.modelId,
        latencyMs: Date.now() - start,
        errorCode: "MISSING_API_KEY",
        errorMessage: `Secret ${input.secretReference} is not configured`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.modelId)}:generateContent`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemPrompt }] },
          contents: buildContents(input),
          generationConfig: buildGenerationConfig(input),
        }),
      });

      const data = (await res.json()) as GeminiApiResponse;
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const normalized = normalizeGeminiError({
          httpStatus: res.status,
          status: data.error?.status,
          message: data.error?.message,
        });
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs,
          errorCode: normalized.errorCode,
          errorMessage: normalized.errorMessage,
        };
      }

      const rawText = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim();

      if (!rawText) {
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs,
          errorCode: "EMPTY_RESPONSE",
          errorMessage: "Gemini returned no text",
        };
      }

      return {
        ok: true,
        provider: "GEMINI",
        modelId: input.modelId,
        rawText,
        parsed: parseHoroscopeText(rawText),
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        },
        latencyMs,
        truncated: data.candidates?.[0]?.finishReason === "MAX_TOKENS",
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        provider: "GEMINI",
        modelId: input.modelId,
        latencyMs: Date.now() - start,
        errorCode: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
        errorMessage: err instanceof Error ? err.message : "Gemini request failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Stream tokens via Gemini streamGenerateContent (SSE).
   * Calls onDelta for each text chunk; returns the final assembled result.
   */
  async streamGenerate(
    input: GenerateAIInput,
    onDelta: (chunk: string) => void,
    shouldStop?: () => Promise<boolean>,
  ): Promise<GenerateAIResult> {
    const start = Date.now();
    const apiKey = resolveSecret(input.secretReference);

    if (!apiKey) {
      return {
        ok: false,
        provider: "GEMINI",
        modelId: input.modelId,
        latencyMs: Date.now() - start,
        errorCode: "MISSING_API_KEY",
        errorMessage: `Secret ${input.secretReference} is not configured`,
      };
    }

    const controller = new AbortController();
    // Idle timeout, not a wall clock: a long Thai answer streams for well over a
    // flat 30s. Aborting on total elapsed threw away everything already streamed
    // and surfaced it as a provider error. Reset the timer on every received
    // chunk so only a genuinely stalled upstream (no bytes for timeoutMs) aborts.
    let timer: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      input.timeoutMs,
    );
    const armIdleTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), input.timeoutMs);
    };

    // Hoisted so a stop can return whatever streamed before it.
    let rawText = "";
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let stopped = false;
    let finishReason: string | undefined;

    // Check stop often enough that the button feels instant (~250ms).
    const STOP_POLL_MS = 250;
    let lastStopCheck = 0;
    const checkStop = async (): Promise<boolean> => {
      if (!shouldStop) return false;
      const now = Date.now();
      if (now - lastStopCheck < STOP_POLL_MS) return false;
      lastStopCheck = now;
      return shouldStop().catch(() => false);
    };

    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.modelId)}:streamGenerateContent?alt=sse`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemPrompt }] },
          contents: buildContents(input),
          generationConfig: buildGenerationConfig(input),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as GeminiApiResponse;
        const normalized = normalizeGeminiError({
          httpStatus: res.status,
          status: data.error?.status,
          message: data.error?.message,
        });
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs: Date.now() - start,
          errorCode: normalized.errorCode,
          errorMessage: normalized.errorMessage,
        };
      }

      if (!res.body) {
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs: Date.now() - start,
          errorCode: "EMPTY_RESPONSE",
          errorMessage: "Gemini stream returned no body",
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (await checkStop()) {
          stopped = true;
          // Abort the upstream request so Gemini stops generating immediately.
          controller.abort();
          await reader.cancel().catch(() => {});
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        // Bytes are flowing — push the idle deadline out.
        armIdleTimeout();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload) as GeminiApiResponse;
            const chunk =
              data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
              "";
            if (chunk) {
              rawText += chunk;
              onDelta(chunk);
            }
            if (data.usageMetadata?.promptTokenCount != null) {
              inputTokens = data.usageMetadata.promptTokenCount;
            }
            if (data.usageMetadata?.candidatesTokenCount != null) {
              outputTokens = data.usageMetadata.candidatesTokenCount;
            }
            if (data.candidates?.[0]?.finishReason) {
              finishReason = data.candidates[0].finishReason;
            }
          } catch {
            /* ignore malformed SSE lines */
          }
        }
      }

      const latencyMs = Date.now() - start;
      const text = rawText.trim();
      if (!text) {
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs,
          errorCode: stopped ? "STOPPED" : "EMPTY_RESPONSE",
          errorMessage: stopped
            ? "Stopped before any text arrived"
            : "Gemini stream returned no text",
          stopped,
        };
      }

      return {
        ok: true,
        stopped,
        provider: "GEMINI",
        modelId: input.modelId,
        rawText: text,
        parsed: parseHoroscopeText(text),
        usage: { inputTokens, outputTokens },
        latencyMs,
        truncated: finishReason === "MAX_TOKENS",
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      // Abort from an explicit stop is success-with-partial, not a timeout.
      if (stopped && rawText.trim()) {
        return {
          ok: true,
          stopped: true,
          provider: "GEMINI",
          modelId: input.modelId,
          rawText: rawText.trim(),
          parsed: parseHoroscopeText(rawText.trim()),
          usage: { inputTokens, outputTokens },
          latencyMs: Date.now() - start,
        };
      }
      // An idle-timeout that already streamed text is a cut answer, not a lost
      // one — keep what arrived and flag it truncated instead of erroring out.
      if (isTimeout && rawText.trim()) {
        return {
          ok: true,
          provider: "GEMINI",
          modelId: input.modelId,
          rawText: rawText.trim(),
          parsed: parseHoroscopeText(rawText.trim()),
          usage: { inputTokens, outputTokens },
          latencyMs: Date.now() - start,
          truncated: true,
        };
      }
      return {
        ok: false,
        provider: "GEMINI",
        modelId: input.modelId,
        latencyMs: Date.now() - start,
        errorCode: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
        errorMessage: err instanceof Error ? err.message : "Gemini stream failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async validateModel(modelId: string): Promise<boolean> {
    return typeof modelId === "string" && modelId.length > 0;
  }
}
