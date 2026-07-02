import type { AIProvider } from "@prisma/client";
import type { AIProviderAdapter } from "@/server/ai/adapter";
import type { GenerateAIInput, GenerateAIResult } from "@/types";
import { GeminiAdapter } from "@/server/ai/providers/gemini";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

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
    // case "OPENAI": return new OpenAIAdapter();  // future provider
    default:
      throw new AppError("AI_PROVIDER_ERROR", `Unsupported provider ${provider}`);
  }
}

/** Resolve the active config for a category + plan scope. */
export async function resolveConfig(categoryId: string, planScope: "FREE" | "PRO") {
  const config = await prisma.aIProviderConfig.findFirst({
    where: {
      enabled: true,
      OR: [{ categoryId }, { categoryId: null }],
      planScope: { in: [planScope, "ALL"] },
    },
    orderBy: [{ categoryId: "desc" }], // prefer a category-specific config
  });
  if (!config) throw new AppError("AI_PROVIDER_ERROR", "No AI config available");
  return config;
}

type RunInput = Omit<GenerateAIInput, "modelId" | "temperature" | "maxOutputTokens" | "timeoutMs" | "secretReference" | "systemPrompt"> & {
  systemPrompt: string;
};

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
    const adapter = adapterFor(cfg.provider);
    const input: GenerateAIInput = {
      modelId: cfg.modelId,
      systemPrompt: base.systemPrompt,
      userPrompt: base.userPrompt,
      temperature: cfg.temperature,
      maxOutputTokens: cfg.maxOutputTokens,
      timeoutMs: cfg.timeoutMs,
      secretReference: cfg.secretReference,
    };
    return adapter.generate(input);
  };

  const primary = await attempt(config);
  if (primary.ok || !config.fallbackConfigId) return primary;

  const fallback = await prisma.aIProviderConfig.findUnique({
    where: { id: config.fallbackConfigId },
  });
  if (!fallback || !fallback.enabled) return primary;

  return attempt(fallback);
}
