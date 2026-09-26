/**
 * Detect Gemini/OpenAI failures that mean "our shared API wallet/quota is dead"
 * — without this, every chat fails silently while admins stare at AI Studio.
 */

const BILLING_RE =
  /\b(billing|prepay|credit(?:s)?|payment|insufficient|no credits|billing account|purchase credits)\b/i;
const QUOTA_RE =
  /\b(quota|rate[- ]?limit|resource[_\s]?exhausted|too many requests|exceeded your current quota)\b/i;

export type ProviderAlertKind = "BILLING" | "QUOTA" | "KEY" | null;

export function classifyProviderFailure(
  errorCode?: string | null,
  errorMessage?: string | null,
): ProviderAlertKind {
  const code = (errorCode ?? "").toUpperCase();
  const msg = errorMessage ?? "";

  if (
    code === "MISSING_API_KEY" ||
    /api[_\s-]?key|permission.?denied|unauthenticated|invalid.?api/i.test(msg) ||
    code === "PERMISSION_DENIED" ||
    code === "UNAUTHENTICATED"
  ) {
    return "KEY";
  }

  if (
    code === "RESOURCE_EXHAUSTED" ||
    code === "429" ||
    BILLING_RE.test(msg) ||
    BILLING_RE.test(code)
  ) {
    // Gemini often uses RESOURCE_EXHAUSTED for both quota and billing.
    if (BILLING_RE.test(msg) || /credit|billing|prepay/i.test(msg)) return "BILLING";
    if (QUOTA_RE.test(msg) || code === "RESOURCE_EXHAUSTED" || code === "429") {
      // Prefer BILLING when message is ambiguous but mentions "limit" + money words already handled.
      return BILLING_RE.test(msg) ? "BILLING" : "QUOTA";
    }
  }

  if (BILLING_RE.test(msg)) return "BILLING";
  if (QUOTA_RE.test(msg)) return "QUOTA";
  return null;
}

/** Normalize Gemini HTTP errors into stable codes for logs + alerts. */
export function normalizeGeminiError(input: {
  httpStatus: number;
  status?: string;
  message?: string;
}): { errorCode: string; errorMessage: string; alert: ProviderAlertKind } {
  const status = input.status ?? String(input.httpStatus);
  const message = input.message ?? `Gemini HTTP ${input.httpStatus}`;
  const alert = classifyProviderFailure(status, message);

  if (alert === "BILLING") {
    return {
      errorCode: "BILLING_EXHAUSTED",
      errorMessage: message,
      alert,
    };
  }
  if (alert === "QUOTA") {
    return {
      errorCode: "PROVIDER_QUOTA",
      errorMessage: message,
      alert,
    };
  }
  if (alert === "KEY") {
    return {
      errorCode: "MISSING_OR_INVALID_KEY",
      errorMessage: message,
      alert,
    };
  }
  return { errorCode: status, errorMessage: message, alert: null };
}

/**
 * What a USER sees when the site's AI side fails. These used to be written for
 * the admin — "เครดิต Gemini อาจหมด กรุณาเติมเงินใน Google AI Studio" — and
 * went straight into the chat, telling customers which vendor we use and that
 * we had not paid it. The wording for running out is the team's own. Admins
 * still get the real cause from the logs and the AI status panel.
 */
export const AI_CAPACITY_USER_MESSAGE =
  "ขณะนี้มีผู้ใช้งานระบบพร้อมกันเป็นจำนวนมาก เรากำลังเร่งขยายขีดความสามารถ" +
  "เพื่อให้คุณกลับมาใช้งานได้โดยเร็วที่สุด กรุณาลองใหม่อีกครั้งในภายหลัง";

export const AI_UNAVAILABLE_USER_MESSAGE =
  "ระบบทำนายขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง";

export function providerAlertUserMessage(kind: ProviderAlertKind): string | null {
  if (kind === "BILLING" || kind === "QUOTA") return AI_CAPACITY_USER_MESSAGE;
  if (kind === "KEY") return AI_UNAVAILABLE_USER_MESSAGE;
  return null;
}

export function logProviderAlert(
  kind: ProviderAlertKind,
  detail: { modelId?: string; errorCode?: string | null; errorMessage?: string | null },
) {
  if (!kind) return;
  console.error(
    `[CRITICAL][AI_${kind}] model=${detail.modelId ?? "?"} code=${detail.errorCode ?? "?"} ${detail.errorMessage ?? ""}`.trim(),
  );
}
