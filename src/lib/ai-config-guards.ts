import type { SupportedAIProvider } from "@/config/ai-provider-models";

/** Env var names allowed as legacy `secretReference` fallbacks. */
export const ALLOWED_AI_SECRET_REFS = ["GEMINI_API_KEY", "OPENAI_API_KEY"] as const;

export type AllowedAiSecretRef = (typeof ALLOWED_AI_SECRET_REFS)[number];

export function isAllowedAiSecretRef(name: string | null | undefined): name is AllowedAiSecretRef {
  if (!name) return false;
  return (ALLOWED_AI_SECRET_REFS as readonly string[]).includes(name);
}

export function defaultSecretRefForProvider(provider: SupportedAIProvider): AllowedAiSecretRef {
  return provider === "GEMINI" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
}

/**
 * Validate OpenAI-compatible Base URL: HTTPS only, no credentials,
 * no localhost / private network hosts.
 */
export function assertSafeOpenAiBaseUrl(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Base URL ไม่ถูกต้อง");
  }
  if (url.protocol !== "https:") {
    throw new Error("Base URL ต้องเป็น HTTPS เท่านั้น");
  }
  if (url.username || url.password) {
    throw new Error("Base URL ห้ามมี username/password");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "0.0.0.0" ||
    host.startsWith("169.254.") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Base URL ห้ามชี้ localhost หรือเครือข่ายภายใน");
  }
  return url.toString().replace(/\/+$/, "");
}
