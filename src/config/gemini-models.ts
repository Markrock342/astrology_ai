/**
 * Gemini model IDs — editable from Admin → โมเดล AI.
 * Google retired 2.5 / 2.0 flash in mid-2026; 3.1 Flash Lite is superseded by 3.5 Lite.
 */

/** Balanced default (Pro). */
export const DEFAULT_GEMINI_MODEL_ID = "gemini-3.6-flash";

/** Cheapest tier (Free / fallback). */
export const DEFAULT_GEMINI_LITE_MODEL_ID = "gemini-3.5-flash-lite";

/** Quick-pick options in Admin CMS. */
export const GEMINI_MODEL_PRESETS: { id: string; label: string }[] = [
  { id: DEFAULT_GEMINI_LITE_MODEL_ID, label: "3.5 Flash Lite — ถูกสุด (แนะนำ Free)" },
  { id: "gemini-3.5-flash", label: "3.5 Flash — สมดุล" },
  { id: DEFAULT_GEMINI_MODEL_ID, label: "3.6 Flash — เร็ว/ฉลาด (แนะนำ Pro)" },
];

/** Old IDs Google removed or superseded — show admin a nudge to migrate. */
export const GEMINI_DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash": DEFAULT_GEMINI_MODEL_ID,
  "gemini-2.5-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-2.0-flash": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-2.0-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-3.1-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
};

export function geminiReplacementHint(modelId: string): string | null {
  const next = GEMINI_DEPRECATED_MODELS[modelId.trim().toLowerCase()];
  return next ? `โมเดลนี้ถูกยกเลิกแล้ว — เปลี่ยนเป็น ${next}` : null;
}
