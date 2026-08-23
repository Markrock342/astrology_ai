-- One-month launch promotion approved for all current users.
-- New users receive the same timed subscription + grant in provisioning.ts.
-- ALLOW_DESTRUCTIVE: no deletes; adds an expiring Pro subscription and an
-- immutable +50 credit ledger entry once per user.
BEGIN;

INSERT INTO "credit_wallets" ("id", "userId", "balance", "version", "updatedAt")
SELECT
  CONCAT('promo_wallet_', md5(u."id" || ':horasard-pro-month-2026-08')),
  u."id",
  0,
  0,
  NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "credit_wallets" w WHERE w."userId" = u."id"
);

UPDATE "credit_wallets" w
SET
  "balance" = w."balance" + 50,
  "version" = w."version" + 1,
  "updatedAt" = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "credit_transactions" t
  WHERE t."userId" = w."userId"
    AND t."referenceType" = 'PROMOTION'
    AND t."referenceId" = CONCAT('horasard-pro-month-2026-08:', w."userId")
);

INSERT INTO "credit_transactions" (
  "id", "userId", "amount", "type", "referenceType", "referenceId", "note", "createdAt"
)
SELECT
  CONCAT('promo_credit_', md5(u."id" || ':horasard-pro-month-2026-08')),
  u."id",
  50,
  'PROMOTION'::"CreditTxnType",
  'PROMOTION',
  CONCAT('horasard-pro-month-2026-08:', u."id"),
  'Pro ทดลอง 1 เดือน +50 เครดิต',
  NOW()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "credit_transactions" t
  WHERE t."userId" = u."id"
    AND t."referenceType" = 'PROMOTION'
    AND t."referenceId" = CONCAT('horasard-pro-month-2026-08:', u."id")
);

INSERT INTO "user_subscriptions" (
  "id", "userId", "packageId", "status", "startsAt", "expiresAt",
  "activationSource", "createdAt", "updatedAt"
)
SELECT
  CONCAT('promo_sub_', md5(u."id" || ':horasard-pro-month-2026-08')),
  u."id",
  p."id",
  'ACTIVE'::"SubscriptionStatus",
  '2026-08-22T17:00:00.000Z'::timestamptz,
  '2026-09-23T16:59:59.000Z'::timestamptz,
  'SYSTEM_DEFAULT'::"ActivationSource",
  NOW(),
  NOW()
FROM "users" u
CROSS JOIN "packages" p
WHERE p."code" = 'PRO'
  AND NOT EXISTS (
    SELECT 1
    FROM "user_subscriptions" s
    WHERE s."id" = CONCAT('promo_sub_', md5(u."id" || ':horasard-pro-month-2026-08'))
  );

COMMIT;
