-- ALLOW_DESTRUCTIVE: the UPDATE below only fills a column this same migration
-- just created, so every row it touches was NULL a statement ago. Nothing is
-- overwritten. Already applied to production long before the guard existed —
-- marked so the guard, which scans every migration on every build, does not
-- block deploys forever over a backfill that already happened.

-- Email verification (soft): track verified state + one-time tokens.
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Grandfather existing accounts so they are not prompted to verify.
UPDATE "users" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;

CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens"("tokenHash");
CREATE INDEX "email_verification_tokens_userId_idx" ON "email_verification_tokens"("userId");

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
