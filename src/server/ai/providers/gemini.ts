import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult } from "@/types";
import { resolveSecret } from "@/config/env";

/**
 * Gemini adapter — initial provider (spec 3).
 *
 * Backend task (Milestone 3): call the Gemini REST/SDK endpoint here using the
 * key resolved from `input.secretReference`. Enforce `timeoutMs` via
 * AbortController. Return the normalized GenerateAIResult; DO NOT throw on
 * provider errors — return `ok: false` with an errorCode so the router can
 * decide about fallback WITHOUT any credit being charged.
 *
 * This stub returns a placeholder so the app compiles and the flow can be
 * wired/tested before the real integration lands.
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

    // TODO(Milestone 3): real Gemini call with AbortController(timeoutMs).
    return {
      ok: false,
      provider: "GEMINI",
      modelId: input.modelId,
      latencyMs: Date.now() - start,
      errorCode: "NOT_IMPLEMENTED",
      errorMessage: "Gemini integration is implemented in Milestone 3",
    };
  }

  async validateModel(modelId: string): Promise<boolean> {
    return typeof modelId === "string" && modelId.length > 0;
  }
}
