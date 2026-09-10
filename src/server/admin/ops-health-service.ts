import { getRateLimitBackend } from "@/lib/rate-limit";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";
import { prisma } from "@/server/db";

const DATABASE_HEALTH_TIMEOUT_MS = 3_000;

export async function getDatabaseHealth() {
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("database health check timed out")),
          DATABASE_HEALTH_TIMEOUT_MS,
        );
      }),
    ]);

    return {
      connected: true,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      connected: false,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Ops readiness for admin — never returns secret values or database URLs. */
export async function getOpsHealth() {
  const upstashConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
  return {
    database: await getDatabaseHealth(),
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
