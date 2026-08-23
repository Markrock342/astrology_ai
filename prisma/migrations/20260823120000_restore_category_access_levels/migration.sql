-- Restore the product access matrix for databases that were edited before
-- category permissions were enforced server-side.
-- ALLOW_DESTRUCTIVE: intentional idempotent access-policy backfill; updates only seven seeded category rows and does not delete user data.
UPDATE "HoroscopeCategory"
SET "accessLevel" = 'FREE'
WHERE "slug" IN ('self', 'career');

UPDATE "HoroscopeCategory"
SET "accessLevel" = 'PRO'
WHERE "slug" IN ('finance', 'love', 'health', 'fortune', 'overview');
