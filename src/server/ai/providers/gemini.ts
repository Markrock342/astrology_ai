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
    /**
     * Prompt tokens served from the implicit cache — billed at 10% of the input
     * rate. Included in promptTokenCount, so cost must subtract them out rather
     * than add them on. Implicit caching is on by default for 2.5+ models but
     * only fires once the prefix clears the model's minimum (4,096 tokens on
     * 3.5 Flash), so a zero here is real information: we are not clearing it.
     */
    cachedContentTokenCount?: number;
    /** Gemini 3 draws thinking from maxOutputTokens but does NOT count it in
     *  candidatesTokenCount — so a cap hit can look like a short answer. */
    thoughtsTokenCount?: number;
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
          cachedTokens: data.usageMetadata?.cachedContentTokenCount,
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
    /**
     * Deadline on TEXT progress, not on bytes.
     *
     * A flat wall clock cut long healthy answers mid-stream. But resetting on
     * every received chunk was worse: Gemini 3 streams thinking chunks that
     * carry no text, so the timer was rearmed forever and a model that produced
     * nothing hung the user indefinitely with no error and no way out.
     *
     * So: the first token must arrive within timeoutMs (absolute), and after
     * that each real text chunk buys another timeoutMs. Thinking-only frames
     * buy nothing.
     */
    let timer: ReturnType<typeof setTimeout> = setTimeout(
      () => controller.abort(),
      input.timeoutMs,
    );
    const extendOnTextProgress = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), input.timeoutMs);
    };

    // Hoisted so a stop can return whatever streamed before it.
    let rawText = "";
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let cachedTokens: number | undefined;
    let stopped = false;
    let finishReason: string | undefined;
    let firstTokenAt: number | undefined;
    let thoughtTokens: number | undefined;

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
              if (firstTokenAt === undefined) firstTokenAt = Date.now();
              rawText += chunk;
              // Real text — and only real text — buys more time.
              extendOnTextProgress();
              onDelta(chunk);
            }
            if (data.usageMetadata?.promptTokenCount != null) {
              inputTokens = data.usageMetadata.promptTokenCount;
            }
            if (data.usageMetadata?.candidatesTokenCount != null) {
              outputTokens = data.usageMetadata.candidatesTokenCount;
            }
            if (data.usageMetadata?.cachedContentTokenCount != null) {
              cachedTokens = data.usageMetadata.cachedContentTokenCount;
            }
            if (data.usageMetadata?.thoughtsTokenCount != null) {
              thoughtTokens = data.usageMetadata.thoughtsTokenCount;
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
        // Gemini 3 draws thinking from the same maxOutputTokens budget. Hitting
        // the cap with nothing written means the whole allowance went to
        // reasoning — say so, or it looks like a random provider failure.
        const starvedByThinking = !stopped && finishReason === "MAX_TOKENS";
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs,
          errorCode: stopped
            ? "STOPPED"
            : starvedByThinking
              ? "OUTPUT_BUDGET_EXHAUSTED"
              : "EMPTY_RESPONSE",
          errorMessage: stopped
            ? "Stopped before any text arrived"
            : starvedByThinking
              ? `Model spent its entire ${input.maxOutputTokens}-token output budget on thinking and wrote no answer — raise maxOutputTokens for this mode`
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
        usage: { inputTokens, outputTokens, cachedTokens },
        latencyMs,
        // Two signals, because the first one demonstrably misses: a real answer
        // came back cut MID-WORD with finishReason unset while text(661) +
        // thinking(~600) had exhausted the 1280 budget exactly. Thinking is
        // drawn from maxOutputTokens but hidden from candidatesTokenCount, so
        // the budget math is the reliable tell.
        truncated:
          finishReason === "MAX_TOKENS" ||
          (outputTokens ?? 0) + (thoughtTokens ?? 0) >=
            input.maxOutputTokens - 8,
        firstTokenMs: firstTokenAt !== undefined ? firstTokenAt - start : undefined,
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
          usage: { inputTokens, outputTokens, cachedTokens },
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
          usage: { inputTokens, outputTokens, cachedTokens },
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
