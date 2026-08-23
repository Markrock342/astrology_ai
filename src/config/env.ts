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

  // Reverse-geocoding endpoint used only after the user explicitly taps
  // "use current location". Kept configurable so ops can switch providers.
  GEOCODER_BASE_URL: z.string().url().optional(),
  GEOCODER_FALLBACK_BASE_URL: z.string().url().optional(),

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
  // Set "true" to make auth REFUSE requests when Upstash is absent (hard
  // fail-closed). Default (unset) falls back to in-memory so auth stays up.
  AUTH_RATELIMIT_STRICT: z.string().optional(),

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
  // Resend webhook signing secret (whsec_…) for inbound support@ mail.
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Vercel Cron auth for /api/cron/* (Authorization: Bearer …).
  CRON_SECRET: z.string().optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

/**
 * During `next build`, Coolify/Nixpacks (and some CI hosts) may not inject
 * runtime secrets into the build container. Page-data collection still imports
 * this module — allow a soft skip so the image can build; the real process
 * must have DATABASE_URL + AUTH_SECRET at runtime.
 */
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.npm_lifecycle_event === "build";

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  if (!isBuildPhase) {
    throw new Error("Invalid environment variables");
  }
}

export const env = (parsed.success ? parsed.data : process.env) as z.infer<
  typeof serverEnvSchema
>;

/**
 * Resolve an AI provider API key by its secret reference (the env var NAME).
 * Only whitelisted names are read — arbitrary env keys are ignored.
 */
export function resolveSecret(secretReference: string): string | undefined {
  if (!isAllowedAiSecretRef(secretReference)) return undefined;
  return process.env[secretReference];
}
