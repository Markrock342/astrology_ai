import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult, HoroscopeResponse } from "@/types";
import { resolveSecret } from "@/config/env";

type GeminiApiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
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

/**
 * Gemini REST adapter (server-only). Uses model id from Admin CMS — default
 * `gemini-2.5-flash` (free tier friendly). Never throws; returns ok:false on errors.
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
          contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
          generationConfig: {
            temperature: input.temperature,
            maxOutputTokens: input.maxOutputTokens,
            // Disable thinking tokens on 2.5 Flash — saves free-tier quota (see Google thinking docs).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });

      const data = (await res.json()) as GeminiApiResponse;
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          ok: false,
          provider: "GEMINI",
          modelId: input.modelId,
          latencyMs,
          errorCode: data.error?.status ?? String(res.status),
          errorMessage: data.error?.message ?? `Gemini HTTP ${res.status}`,
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

  async validateModel(modelId: string): Promise<boolean> {
    return typeof modelId === "string" && modelId.length > 0;
  }
}
