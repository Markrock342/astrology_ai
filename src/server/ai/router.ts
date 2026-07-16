import type { AIProvider } from "@prisma/client";
import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult } from "@/types";
import { GeminiAdapter } from "@/server/ai/providers/gemini";
import { OpenAIAdapter } from "@/server/ai/providers/openai";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { resolveApiKey } from "@/server/ai/secret-resolver";

/**
 * Model router (spec 3 / 6.5). Resolves an AIProviderConfig from the DB, picks
 * the matching adapter, runs generation, and falls back to `fallbackConfigId`
 * on failure — WITHOUT any credit being charged here. Charging happens only in
 * the reading service after this returns ok.
 */

function adapterFor(provider: AIProvider): AIProviderAdapter {
  switch (provider) {
    case "GEMINI":
      return new GeminiAdapter();
    case "OPENAI":
      return new OpenAIAdapter();
    default:
      throw new AppError("AI_PROVIDER_ERROR", `Unsupported provider ${provider}`);
  }
}

/**
 * Resolve the active config for a category + plan scope.
 * Priority: category-specific beats global, and an exact plan match (FREE/PRO)
 * beats ALL — so admins can point Free at a cheaper model than Pro.
 *
 * `preferFast` (brief mode): prefer a "lite" model when one is configured.
 * Measured TTFT told the story — gemini-3.5-flash takes 9–18s to its first
 * token while the flash-lite fallback answers the same ~9k-token prompt in
 * ~0.8s. Brief mode trades depth for speed by design, so it should not pay the
 * heavy model's thinking latency; it drops to the lite model and feels instant.
 */
export async function resolveConfig(
  categoryId: string,
  planScope: "FREE" | "PRO",
  opts?: { preferFast?: boolean },
) {
  const candidates = await prisma.aIProviderConfig.findMany({
    where: {
      enabled: true,
      OR: [{ categoryId }, { categoryId: null }],
      planScope: { in: [planScope, "ALL"] },
    },
  });
  if (candidates.length === 0) {
    throw new AppError("AI_PROVIDER_ERROR", "No AI config available");
  }

  const score = (c: (typeof candidates)[number]) =>
    (c.categoryId === categoryId ? 2 : 0) + (c.planScope === planScope ? 1 : 0);

  if (opts?.preferFast) {
    // Keep the category-match preference, but only among lite (fast) models.
    // Fall through to normal resolution if the admin configured none.
    const lite = candidates
      .filter((c) => c.modelId.toLowerCase().includes("lite"))
      .sort((a, b) => score(b) - score(a));
    if (lite.length > 0) return lite[0];
  }

  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}

type RunInput = Omit<
  GenerateAIInput,
  "modelId" | "temperature" | "maxOutputTokens" | "timeoutMs" | "secretReference" | "apiKey"
> & {
  systemPrompt: string;
  userPrompt: string;
  conversationHistory?: GenerateAIInput["conversationHistory"];
  /** Override Admin maxOutputTokens (e.g. plan-specific cap). */
  maxOutputTokens?: number;
};

async function toGenerateInput(
  cfg: {
    id: string;
    modelId: string;
    temperature: number;
    maxOutputTokens: number;
    timeoutMs: number;
    secretReference: string | null;
    encryptedApiKey: string | null;
  },
  base: RunInput,
): Promise<GenerateAIInput> {
  const apiKey = await resolveApiKey(cfg);
  if (!apiKey) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      `API key missing for config ${cfg.id} (set encrypted key in admin or env ${cfg.secretReference ?? "—"})`,
    );
  }
  return {
    modelId: cfg.modelId,
    systemPrompt: base.systemPrompt,
    userPrompt: base.userPrompt,
    conversationHistory: base.conversationHistory,
    temperature: cfg.temperature,
    maxOutputTokens: base.maxOutputTokens ?? cfg.maxOutputTokens,
    timeoutMs: cfg.timeoutMs,
    apiKey,
    secretReference: cfg.secretReference ?? undefined,
  };
}

/**
 * Generate using a config, trying its fallback once on failure. Returns the
 * result of whichever attempt succeeded, or the last failure.
 */
export async function generateWithFallback(
  configId: string,
  base: RunInput,
): Promise<GenerateAIResult> {
  const config = await prisma.aIProviderConfig.findUnique({ where: { id: configId } });
  if (!config) throw new AppError("AI_PROVIDER_ERROR", "AI config not found");

  const attempt = async (cfg: NonNullable<typeof config>) => {
    try {
      const adapter = adapterFor(cfg.provider);
      return await adapter.generate(await toGenerateInput(cfg, base));
    } catch (err) {
      if (err instanceof AppError && err.code === "AI_PROVIDER_ERROR") {
        return {
          ok: false as const,
          provider: cfg.provider,
          modelId: cfg.modelId,
          latencyMs: 0,
          errorCode: "MISSING_API_KEY",
          errorMessage: err.message,
        };
      }
      throw err;
    }
  };

  const primary = await attempt(config);
  if (primary.ok || !config.fallbackConfigId) return primary;

  const fallback = await prisma.aIProviderConfig.findUnique({
    where: { id: config.fallbackConfigId },
  });
  if (!fallback || !fallback.enabled) return primary;

  return attempt(fallback);
}

/**
 * Stream generation with the same fallback rules as generateWithFallback.
 * Gemini streams tokens; other providers fall back to one-shot then one delta.
 */
export async function streamWithFallback(
  configId: string,
  base: RunInput,
  onDelta: (chunk: string) => void,
  shouldStop?: () => Promise<boolean>,
): Promise<GenerateAIResult> {
  const config = await prisma.aIProviderConfig.findUnique({ where: { id: configId } });
  if (!config) throw new AppError("AI_PROVIDER_ERROR", "AI config not found");

  // Count what reached the client. If the primary already streamed text and then
  // failed, running the fallback would push a SECOND full answer down the same
  // onDelta with no reset — the user would see two answers concatenated.
  let emittedChars = 0;
  const countingDelta = (chunk: string) => {
    emittedChars += chunk.length;
    onDelta(chunk);
  };

  const attempt = async (cfg: NonNullable<typeof config>) => {
    try {
      const adapter = adapterFor(cfg.provider);
      const input = await toGenerateInput(cfg, base);
      if (adapter instanceof GeminiAdapter) {
        return adapter.streamGenerate(input, countingDelta, shouldStop);
      }
      const result = await adapter.generate(input);
      if (result.ok && result.rawText) countingDelta(result.rawText);
      return result;
    } catch (err) {
      if (err instanceof AppError && err.code === "AI_PROVIDER_ERROR") {
        return {
          ok: false as const,
          provider: cfg.provider,
          modelId: cfg.modelId,
          latencyMs: 0,
          errorCode: "MISSING_API_KEY",
          errorMessage: err.message,
        };
      }
      throw err;
    }
  };

  const primary = await attempt(config);
  // A stop is the user's decision, not a provider failure — retrying it on the
  // fallback would restart the answer they just cancelled, and bill them for it.
  if (primary.ok || primary.stopped || !config.fallbackConfigId) return primary;
  // Primary already painted a partial answer — don't double it with a fallback.
  if (emittedChars > 0) return primary;

  const fallback = await prisma.aIProviderConfig.findUnique({
    where: { id: config.fallbackConfigId },
  });
  if (!fallback || !fallback.enabled) return primary;

  return attempt(fallback);
}
