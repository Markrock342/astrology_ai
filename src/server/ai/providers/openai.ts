import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult, HoroscopeResponse } from "@/types";
import { resolveSecret } from "@/config/env";

type OpenAIApiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string; code?: string };
};

/** Best-effort parse; horoscope output may be plain Thai prose if JSON parse fails. */
function parseHoroscopeText(raw: string): HoroscopeResponse | undefined {
  const jsonMatch = raw.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) return undefined;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as HoroscopeResponse;
    if (parsed.title && parsed.summary) return parsed;
  } catch {
    /* fall through */
  }
  return undefined;
}

/**
 * OpenAI chat-completions adapter (server-only). Enabled by creating an
 * AIProviderConfig with provider=OPENAI + secretReference=OPENAI_API_KEY in the
 * Admin CMS. Never throws; returns ok:false on errors.
 */
export class OpenAIAdapter implements AIProviderAdapter {
  async generate(input: GenerateAIInput): Promise<GenerateAIResult> {
    const start = Date.now();
    const apiKey = resolveSecret(input.secretReference);

    if (!apiKey) {
      return {
        ok: false,
        provider: "OPENAI",
        modelId: input.modelId,
        latencyMs: Date.now() - start,
        errorCode: "MISSING_API_KEY",
        errorMessage: `Secret ${input.secretReference} is not configured`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const historyMessages = (input.conversationHistory ?? []).map((turn) => ({
        role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: turn.content,
      }));

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: input.modelId,
          messages: [
            { role: "system", content: input.systemPrompt },
            ...historyMessages,
            { role: "user", content: input.userPrompt },
          ],
          temperature: input.temperature,
          max_completion_tokens: input.maxOutputTokens,
        }),
      });

      const data = (await res.json()) as OpenAIApiResponse;
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          ok: false,
          provider: "OPENAI",
          modelId: input.modelId,
          latencyMs,
          errorCode: data.error?.code ?? data.error?.type ?? String(res.status),
          errorMessage: data.error?.message ?? `OpenAI HTTP ${res.status}`,
        };
      }

      const rawText = data.choices?.[0]?.message?.content?.trim();
      if (!rawText) {
        return {
          ok: false,
          provider: "OPENAI",
          modelId: input.modelId,
          latencyMs,
          errorCode: "EMPTY_RESPONSE",
          errorMessage: "OpenAI returned no text",
        };
      }

      return {
        ok: true,
        provider: "OPENAI",
        modelId: input.modelId,
        rawText,
        parsed: parseHoroscopeText(rawText),
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
        latencyMs,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        provider: "OPENAI",
        modelId: input.modelId,
        latencyMs: Date.now() - start,
        errorCode: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
        errorMessage: err instanceof Error ? err.message : "OpenAI request failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async validateModel(modelId: string): Promise<boolean> {
    return typeof modelId === "string" && modelId.length > 0;
  }
}
