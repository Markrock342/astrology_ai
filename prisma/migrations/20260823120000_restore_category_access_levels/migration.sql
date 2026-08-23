-- Restore the product access matrix for databases that were edited before
-- category permissions were enforced server-side.
-- ALLOW_DESTRUCTIVE: intentional idempotent access-policy backfill; updates only seven seeded category rows and does not delete user data.
UPDATE "horoscope_categories"
SET "accessLevel" = 'FREE'
WHERE "slug" IN ('self', 'career');

UPDATE "horoscope_categories"
SET "accessLevel" = 'PRO'
WHERE "slug" IN ('finance', 'love', 'health', 'fortune', 'overview');
