import type { AIProvider } from "@prisma/client";
import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult } from "@/types";
import { GeminiAdapter } from "@/server/ai/providers/gemini";
import { OpenAIAdapter } from "@/server/ai/providers/openai";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { resolveApiKey } from "@/server/ai/secret-resolver";
import {
  detailedGeminiRank,
  isDetailedGeminiModel,
  isGeminiLiteModel,
} from "@/config/gemini-models";
import { briefTurnCostUsd } from "@/config/ai-pricing";

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
 * `preferFast` (brief / กระชับ): the CHEAPEST non-lite model in the pool, by
 * real rate card. It used to prefer 3.5 Flash by name, which bills $1.50/$9.00
 * per 1M tokens against 3.7 Flash's $0.75/$3.75 — and since the prompt (chart
 * tables + doctrine + memory) is identical in both modes and dwarfs a short
 * answer, กระชับ burned as much usage as ละเอียด, often more. Lite stays a
 * last-resort fallback: as the brief primary it made กระชับ answers vaguer.
 * Detailed (ละเอียด): prefer 3.7 / 3.6 Flash when one is in the eligible pool.
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

  const pickDeterministic = (
    pool: typeof candidates,
    extraRank: (c: (typeof candidates)[number]) => number = () => 0,
  ) => {
    const ranked = [...pool].sort((a, b) => {
      const scoreDiff = score(b) - score(a);
      if (scoreDiff !== 0) return scoreDiff;
      const extraDiff = extraRank(b) - extraRank(a);
      if (extraDiff !== 0) return extraDiff;
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
    const nonLite = candidates.filter((c) => !isGeminiLiteModel(c.modelId));
    if (nonLite.length > 0) {
      // Negated so "higher rank wins" means "cheaper model wins".
      return pickDeterministic(nonLite, (c) => -briefTurnCostUsd(c.modelId));
    }
  } else {
    const detailed = candidates.filter((c) => isDetailedGeminiModel(c.modelId));
    if (detailed.length > 0) {
      return pickDeterministic(detailed, (c) => detailedGeminiRank(c.modelId));
    }
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

  let result = await generateOnce(configId, base);
  for (const next of await fallbackChain(config)) {
    if (result.ok) break;
    result = await generateOnce(next.id, base);
  }
  return result;
}

/**
 * What to try when a config fails: its own fallback if one is set, then
 * the other enabled models — Lite first, being the least overloaded. Only an
 * explicitly set fallback used to be tried, and none was, so when Gemini was
 * overloaded on 1 Oct 2026 every answer failed while Flash Lite sat enabled
 * and unused. At most two extra attempts, never the same model twice.
 */
async function fallbackChain(config: { id: string; modelId: string; fallbackConfigId: string | null }) {
  const enabled = await prisma.aIProviderConfig.findMany({
    where: { enabled: true, id: { not: config.id } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  const explicit = enabled.filter((c) => c.id === config.fallbackConfigId);
  const others = enabled
    .filter((c) => c.id !== config.fallbackConfigId)
    .sort((a, b) => Number(isGeminiLiteModel(b.modelId)) - Number(isGeminiLiteModel(a.modelId)));
  const seen = new Set([config.modelId]);
  const chain: typeof enabled = [];
  for (const c of [...explicit, ...others]) {
    if (seen.has(c.modelId)) continue;
    seen.add(c.modelId);
    chain.push(c);
    if (chain.length === 2) break;
  }
  return chain;
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

  let result = await attempt(config);
  for (const next of await fallbackChain(config)) {
    // A stop is the user's decision, not a provider failure — retrying it on
    // the fallback would restart the answer they just cancelled, and bill them.
    if (result.ok || result.stopped) break;
    // An attempt already painted a partial answer — don't double it.
    if (emittedChars > 0) break;
    result = await attempt(next);
  }
  return result;
}
