-- Admin list + dashboard query performance indexes
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users" ("createdAt");
CREATE INDEX IF NOT EXISTS "ai_usage_logs_createdAt_idx" ON "ai_usage_logs" ("createdAt");
CREATE INDEX IF NOT EXISTS "credit_transactions_type_createdAt_idx" ON "credit_transactions" ("type", "createdAt");
CREATE INDEX IF NOT EXISTS "payments_status_createdAt_idx" ON "payments" ("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "admin_audit_logs_createdAt_idx" ON "admin_audit_logs" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "conversations_userId_mode_updatedAt_idx" ON "conversations" ("userId", "mode", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "messages_conversationId_status_idx" ON "messages" ("conversationId", "status");
