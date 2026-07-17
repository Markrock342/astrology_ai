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
  if (url.search || url.hash) {
    throw new Error("Base URL ห้ามมี query string หรือ fragment");
  }
  if (/\/(?:chat\/completions|completions|models)\/?$/i.test(url.pathname)) {
    throw new Error("Base URL ต้องเป็น API root เช่น https://api.example.com/v1");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
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
    host === "::" ||
    host === "::1" ||
    /^f[cd][0-9a-f]{2}:/i.test(host) ||
    /^fe[89ab][0-9a-f]:/i.test(host) ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Base URL ห้ามชี้ localhost หรือเครือข่ายภายใน");
  }
  return url.toString().replace(/\/+$/, "");
}
