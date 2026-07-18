/**
 * Model pricing — USD per 1M tokens, paid tier.
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 *
 * Output costs 6× input on the chat model ($9.00 vs $1.50), so answer LENGTH is
 * the dominant cost lever — not the size of the prompt we send. Cached input is
 * 90% off, which is what makes the fixed chart/knowledge prefix worth caching.
 *
 * Keep this in sync with Google's page. Everything downstream (the admin
 * cost/profit view, estimatedCost on each usage row) reads from here, so a wrong
 * number here is a wrong number everywhere.
 */
export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
  /** Implicit + explicit cache hits bill at this rate instead of input. */
  cachedInputPerMTok: number;
};

export const AI_PRICING: Record<string, ModelPricing> = {
  "gemini-3.5-flash": {
    inputPerMTok: 1.5,
    outputPerMTok: 9.0,
    cachedInputPerMTok: 0.15,
  },
  "gemini-3.1-flash-lite": {
    inputPerMTok: 0.25,
    outputPerMTok: 1.5,
    cachedInputPerMTok: 0.025,
  },
  // OpenAI (per 1M tokens; cached input at OpenAI's 50% prompt-cache rate).
  // Source: https://openai.com/api/pricing — keep in sync when adding GPT rows
  // via the admin "โมเดล AI" form so cost/profit reports aren't Gemini-priced.
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10.0, cachedInputPerMTok: 1.25 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6, cachedInputPerMTok: 0.075 },
  "gpt-4.1": { inputPerMTok: 2.0, outputPerMTok: 8.0, cachedInputPerMTok: 0.5 },
  "gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6, cachedInputPerMTok: 0.1 },
  "gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4, cachedInputPerMTok: 0.025 },
};

/** Gemini fallback for unknown Gemini/preview ids. */
export const FALLBACK_PRICING: ModelPricing = AI_PRICING["gemini-3.5-flash"];
/** OpenAI fallback so a GPT id we lack a row for isn't billed at Gemini rates. */
const OPENAI_FALLBACK_PRICING: ModelPricing = AI_PRICING["gpt-4o"];

export function pricingFor(modelId: string): ModelPricing {
  const id = modelId.trim().toLowerCase();
  const known = AI_PRICING[id];
  if (known) return known;
  // Provider-aware fallback: never price a GPT/o-series model with the Gemini
  // table (a ~10× error in the cost/profit view). Only true Gemini/unknowns use
  // the Gemini fallback.
  if (id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3")) {
    return OPENAI_FALLBACK_PRICING;
  }
  return FALLBACK_PRICING;
}

/** True when we are guessing — the UI says so rather than quietly lying. */
export function hasKnownPricing(modelId: string): boolean {
  return modelId.trim().toLowerCase() in AI_PRICING;
}

/**
 * THB per USD. Only used for display next to package prices, which are in baht.
 * Override with AI_USD_THB when the rate moves enough to matter.
 */
export const USD_TO_THB = Number(process.env.AI_USD_THB ?? 36);

/**
 * Cost of one call, in USD.
 *
 * `cachedTokens` is a SUBSET of `inputTokens` (Gemini reports cache hits inside
 * promptTokenCount), so it is subtracted out and re-billed at the cache rate —
 * adding it on top would double-count the same tokens.
 */
export function estimateCostUsd(
  modelId: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  cachedTokens: number | null | undefined = 0,
): number {
  const p = pricingFor(modelId);
  const inTok = inputTokens ?? 0;
  const outTok = outputTokens ?? 0;
  const cached = Math.min(Math.max(cachedTokens ?? 0, 0), inTok);
  const uncached = inTok - cached;

  return (
    (uncached / 1_000_000) * p.inputPerMTok +
    (cached / 1_000_000) * p.cachedInputPerMTok +
    (outTok / 1_000_000) * p.outputPerMTok
  );
}

export function usdToThb(usd: number): number {
  return usd * USD_TO_THB;
}

/** Baht, at the precision a human actually reads (sub-satang is noise). */
export function formatThb(usd: number): string {
  const thb = usdToThb(usd);
  if (thb === 0) return "฿0";
  if (thb < 1) return `฿${thb.toFixed(3)}`;
  if (thb < 100) return `฿${thb.toFixed(2)}`;
  return `฿${thb.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}
