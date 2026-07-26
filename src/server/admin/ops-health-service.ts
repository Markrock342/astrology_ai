import { getRateLimitBackend } from "@/lib/rate-limit";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";

/** Boolean ops flags for admin — never returns secret values. */
export function getOpsHealth() {
  const upstashConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    rateLimitBackend: getRateLimitBackend(),
    upstashConfigured,
    blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    emailConfigured: Boolean(
      process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim(),
    ),
    cronSecretSet: Boolean(process.env.CRON_SECRET?.trim()),
    aiSecretEncConfigured: isEncryptionConfigured(),
    vapidConfigured: Boolean(
      process.env.VAPID_PUBLIC_KEY?.trim() &&
        process.env.VAPID_PRIVATE_KEY?.trim(),
    ),
  };
}
