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
};

/** Unknown//preview models bill as the standard chat model — never as free. */
export const FALLBACK_PRICING: ModelPricing = AI_PRICING["gemini-3.5-flash"];

export function pricingFor(modelId: string): ModelPricing {
  return AI_PRICING[modelId.trim().toLowerCase()] ?? FALLBACK_PRICING;
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
