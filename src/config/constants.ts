/**
 * App-wide constants and configurable defaults.
 * Business rules that are still unconfirmed (see README "Open Questions") are
 * kept here as editable defaults instead of being hard-coded across the app.
 */

export const APP_NAME = "HoraSard";
export const APP_NAME_TH = "โหราศาสตร์";

/** Default seed values — override via Admin CMS once client confirms. */
export const DEFAULTS = {
  freeCreditQuota: 3,
  proCreditQuota: 100,
  proPriceThb: 199,
  creditCostPerReading: 1,
  aiTimeoutMs: 30_000,
  temperature: 0.7,
  maxOutputTokens: 2048,
  // Editable placeholder — never hard-code an unchangeable model id.
  // Free-tier friendly (Jul 2026). Avoid Pro models — paid-only / expensive.
  // Cheapest: gemini-2.5-flash-lite | Balanced: gemini-2.5-flash
  defaultGeminiModelId: "gemini-2.5-flash",
} as const;

/** Timezone for display. Storage is always UTC (business rule 13). */
export const DISPLAY_TIMEZONE = "Asia/Bangkok";

export const CREDIT_SECRET_ENV = "GEMINI_API_KEY";
