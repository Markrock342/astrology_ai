import type { AIProvider } from "@prisma/client";
import { assertBaseUrlEgressAllowed } from "@/server/ai/base-url-egress";

type DiscoveryInput = {
  provider: Extract<AIProvider, "GEMINI" | "OPENAI">;
  apiKey: string;
  baseUrl?: string | null;
  timeoutMs?: number;
};

export type ModelDiscoveryResult = {
  ok: boolean;
  provider: DiscoveryInput["provider"];
  models: string[];
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
};

type GeminiModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
  error?: { code?: number; status?: string; message?: string };
};

type OpenAIModelsResponse = {
  data?: Array<{ id?: string }>;
  error?: { code?: string; type?: string; message?: string };
};

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * Ask the configured provider which model IDs this key can access.
 *
 * This is advisory: some OpenAI-compatible gateways do not implement GET
 * /models. A successful short generation remains the authoritative test that a
 * specific model ID works.
 */
export async function discoverProviderModels(
  input: DiscoveryInput,
): Promise<ModelDiscoveryResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 20_000);

  try {
    const isGemini = input.provider === "GEMINI";
    const baseUrl = (input.baseUrl?.trim() || OPENAI_DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    const url = isGemini
      ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
      : `${baseUrl}/models`;
    // SSRF guard before hitting an admin-supplied endpoint with the API key.
    if (!isGemini && baseUrl !== OPENAI_DEFAULT_BASE_URL) {
      await assertBaseUrlEgressAllowed(baseUrl);
    }
    const response = await fetch(url, {
      headers: isGemini
        ? { "x-goog-api-key": input.apiKey }
        : { Authorization: `Bearer ${input.apiKey}` },
      signal: controller.signal,
      cache: "no-store",
      redirect: "error",
    });
    const body = (await response.json()) as
      | GeminiModelsResponse
      | OpenAIModelsResponse;
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const error = body.error;
      const providerCode =
        error && typeof error.code === "string"
          ? error.code
          : error && "status" in error
            ? error.status ?? error.code
            : error && "type" in error
              ? error.type
              : undefined;
      return {
        ok: false,
        provider: input.provider,
        models: [],
        latencyMs,
        errorCode: providerCode ? String(providerCode) : String(response.status),
        errorMessage:
          error?.message ??
          `${isGemini ? "Gemini" : "OpenAI-compatible"} HTTP ${response.status}`,
      };
    }

    const models = isGemini
      ? ((body as GeminiModelsResponse).models ?? [])
          .filter((model) =>
            model.supportedGenerationMethods?.includes("generateContent"),
          )
          .map((model) => model.name?.replace(/^models\//, "") ?? "")
      : ((body as OpenAIModelsResponse).data ?? []).map(
          (model) => model.id ?? "",
        );
    const normalized = [...new Set(models.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );

    return {
      ok: true,
      provider: input.provider,
      models: normalized,
      latencyMs,
      errorCode: null,
      errorMessage:
        normalized.length > 0
          ? null
          : "เชื่อมต่อได้ แต่ provider ไม่คืนรายชื่อโมเดล",
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      ok: false,
      provider: input.provider,
      models: [],
      latencyMs: Date.now() - startedAt,
      errorCode: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "ดึงรายชื่อโมเดลไม่สำเร็จ",
    };
  } finally {
    clearTimeout(timer);
  }
}
