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
 * Tie-break (deterministic): higher score → newer updatedAt → id asc.
 * When multiple configs share the same top score, a warning is logged so ops
 * can remove overlapping rows.
 *
 * `preferFast` (brief mode): prefer a "lite" model when one is configured.
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
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  if (candidates.length === 0) {
    throw new AppError("AI_PROVIDER_ERROR", "No AI config available");
  }

  const score = (c: (typeof candidates)[number]) =>
    (c.categoryId === categoryId ? 2 : 0) + (c.planScope === planScope ? 1 : 0);

  const pickDeterministic = (pool: typeof candidates) => {
    const ranked = [...pool].sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      const timeDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
    const winner = ranked[0];
    const topScore = score(winner);
    const ties = ranked.filter((c) => score(c) === topScore);
    if (ties.length > 1) {
      console.warn(
        `[ai-router] overlapping configs for category=${categoryId} plan=${planScope}: ${ties
          .map((c) => c.id)
          .join(", ")} — using ${winner.id}`,
      );
    }
    return winner;
  };

  if (opts?.preferFast) {
    const lite = candidates.filter((c) => c.modelId.toLowerCase().includes("lite"));
    if (lite.length > 0) return pickDeterministic(lite);
  }

  return pickDeterministic(candidates);
}

type RunInput = Omit<
  GenerateAIInput,
  | "modelId"
  | "temperature"
  | "maxOutputTokens"
  | "timeoutMs"
  | "secretReference"
  | "apiKey"
  | "baseUrl"
> & {
  systemPrompt: string;
  userPrompt: string;
  conversationHistory?: GenerateAIInput["conversationHistory"];
  /** Override Admin maxOutputTokens (e.g. plan-specific cap). */
  maxOutputTokens?: number;
  /** Override Admin timeoutMs (e.g. short health probes). */
  timeoutMs?: number;
};

async function toGenerateInput(
  cfg: {
    id: string;
    modelId: string;
    temperature: number;
    maxOutputTokens: number;
    timeoutMs: number;
    baseUrl: string | null;
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
    timeoutMs: base.timeoutMs ?? cfg.timeoutMs,
    baseUrl: cfg.baseUrl ?? undefined,
    apiKey,
    secretReference: cfg.secretReference ?? undefined,
  };
}

/**
 * Generate using exactly one config (no fallback). Used by admin health/test
 * so a broken primary cannot look healthy via its fallback.
 */
export async function generateOnce(
  configId: string,
  base: RunInput,
): Promise<GenerateAIResult> {
  const config = await prisma.aIProviderConfig.findUnique({ where: { id: configId } });
  if (!config) throw new AppError("AI_PROVIDER_ERROR", "AI config not found");

  try {
    const adapter = adapterFor(config.provider);
    return await adapter.generate(await toGenerateInput(config, base));
  } catch (err) {
    if (err instanceof AppError && err.code === "AI_PROVIDER_ERROR") {
      return {
        ok: false as const,
        provider: config.provider,
        modelId: config.modelId,
        latencyMs: 0,
        errorCode: "MISSING_API_KEY",
        errorMessage: err.message,
      };
    }
    throw err;
  }
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

  const primary = await generateOnce(configId, base);
  if (primary.ok || !config.fallbackConfigId) return primary;

  const fallback = await prisma.aIProviderConfig.findUnique({
    where: { id: config.fallbackConfigId },
  });
  if (!fallback || !fallback.enabled) return primary;

  return generateOnce(fallback.id, base);
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
