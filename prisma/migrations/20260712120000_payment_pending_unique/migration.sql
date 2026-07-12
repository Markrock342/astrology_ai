-- At most one PENDING payment per user (defense in depth vs double-submit).
CREATE UNIQUE INDEX IF NOT EXISTS "payments_userId_pending_unique"
ON "payments" ("userId")
WHERE "status" = 'PENDING';
