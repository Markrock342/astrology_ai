import { z } from "zod";
import { isAllowedAiSecretRef } from "@/lib/ai-config-guards";

/**
 * Server-side environment validation. Import this ONLY from server code.
 * Never expose secrets (API keys, DB URL) to the browser.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().optional(),

  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  // Email delivery (password reset, etc). Optional: when unset the mailer logs
  // to the console (dev fallback) instead of sending a real email. Fill these
  // to switch on real delivery via Resend — no code change needed.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  // Public base URL used to build links inside emails (falls back to AUTH_URL).
  APP_BASE_URL: z.string().url().optional(),

  // Cloudflare Turnstile (bot protection on auth forms). Optional locally.
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // AI keys are read by name via secretReference; kept optional so the app can
  // boot without them during early Milestone 1 work. Prefer admin-managed
  // encrypted keys in DB when AI_SECRET_ENC_KEY is set.
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Master key for AES-256-GCM encryption of admin-managed AI API keys in DB.
  // 32 bytes as base64 (`openssl rand -base64 32`) or 64-char hex. Set once
  // on the host — admins never touch this; they paste provider keys in the UI.
  AI_SECRET_ENC_KEY: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),

  // Upstash Redis (M4 B3 distributed rate-limit). Optional — without these,
  // rate-limit.ts falls back to in-memory per process.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Payment slip uploads (Vercel Blob). Required for POST /api/payments/proof.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Supabase Storage (admin CMS images: logo, landing, OG). Server-only.
  SUPABASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional(),
  ),

  // Admin alerts — email + Web Push (PWA).
  ADMIN_ALERT_EMAIL: z.string().email().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

/**
 * Resolve an AI provider API key by its secret reference (the env var NAME).
 * Only whitelisted names are read — arbitrary env keys are ignored.
 */
export function resolveSecret(secretReference: string): string | undefined {
  if (!isAllowedAiSecretRef(secretReference)) return undefined;
  return process.env[secretReference];
}
