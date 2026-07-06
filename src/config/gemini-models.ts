/**
 * Gemini model IDs — editable from Admin → โมเดล AI.
 * Google retired 2.5 / 2.0 flash in mid-2026; use 3.x replacements.
 */

/** Balanced default (Pro / fallback). */
export const DEFAULT_GEMINI_MODEL_ID = "gemini-3.5-flash";

/** Cheapest tier (Free). */
export const DEFAULT_GEMINI_LITE_MODEL_ID = "gemini-3.1-flash-lite";

/** Quick-pick options in Admin CMS. */
export const GEMINI_MODEL_PRESETS: { id: string; label: string }[] = [
  { id: DEFAULT_GEMINI_LITE_MODEL_ID, label: "3.1 Flash Lite — ถูกสุด (แนะนำ Free)" },
  { id: DEFAULT_GEMINI_MODEL_ID, label: "3.5 Flash — สมดุล (แนะนำ Pro)" },
  { id: "gemini-3.1-pro-preview", label: "3.1 Pro Preview — ละเอียด (เสียเงิน)" },
];

/** Old IDs Google removed — show admin a nudge to migrate. */
export const GEMINI_DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash": DEFAULT_GEMINI_MODEL_ID,
  "gemini-2.5-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-2.0-flash": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-2.0-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
};

export function geminiReplacementHint(modelId: string): string | null {
  const next = GEMINI_DEPRECATED_MODELS[modelId.trim().toLowerCase()];
  return next ? `โมเดลนี้ถูกยกเลิกแล้ว — เปลี่ยนเป็น ${next}` : null;
}
