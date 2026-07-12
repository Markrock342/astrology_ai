-- Quota reservation: in-flight slots prevent concurrent over-quota AI calls
ALTER TYPE "UsageStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

CREATE INDEX IF NOT EXISTS "ai_usage_logs_userId_status_createdAt_idx"
  ON "ai_usage_logs" ("userId", "status", "createdAt");
