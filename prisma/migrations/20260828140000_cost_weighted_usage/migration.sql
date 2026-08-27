-- Cost-weighted usage: provider token cost becomes one user-facing percentage.
-- Existing credit tables remain intact for rollback; balances are copied once.
-- ALLOW_DESTRUCTIVE: package rows are intentionally backfilled in place; legacy
-- credit tables remain untouched and the new wallet/ledger are additive.

CREATE TYPE "UsageTxnType" AS ENUM (
  'INITIAL_GRANT',
  'ADMIN_ADD',
  'ADMIN_DEDUCT',
  'AI_USAGE',
  'REFUND',
  'PACKAGE_RENEWAL',
  'PROMOTION',
  'TOP_UP',
  'MIGRATION'
);

CREATE TYPE "UsageBucket" AS ENUM ('INCLUDED', 'PURCHASED', 'MIXED');

ALTER TABLE "packages"
  ADD COLUMN "usageBudgetUnits" INTEGER NOT NULL DEFAULT 0;

-- 1 unit = USD 0.000001. Initial budgets target roughly 20% AI COGS:
-- Free = ฿1, Pro = ฿40, top-up = ฿20 at the current ฿36/USD baseline.
UPDATE "packages" SET "usageBudgetUnits" = 27778 WHERE "code" = 'FREE';
UPDATE "packages" SET "usageBudgetUnits" = 1111111 WHERE "code" = 'PRO';
UPDATE "packages" SET "usageBudgetUnits" = 555556
WHERE "code" IN ('CREDIT_TOPUP', 'TOPUP');

UPDATE "packages"
SET "features" = array_replace("features", 'เครดิต 3 ครั้ง', 'AI usage ทดลอง 100%')
WHERE "code" = 'FREE';
UPDATE "packages"
SET "features" = array_replace("features", 'เครดิต 100 ครั้ง', 'AI usage 100% ต่อรอบแพ็กเกจ')
WHERE "code" = 'PRO';
UPDATE "packages"
SET
  "features" = array_replace(
    array_replace("features", 'เติมเครดิต 50 ครั้ง', 'เติม AI usage อีก 50%'),
    'สำหรับสมาชิก Pro ที่เครดิตหมด',
    'สำหรับสมาชิก Pro ที่ usage ใกล้หมด'
  ),
  "description" = 'เติม usage เพิ่มสำหรับสมาชิก Pro (ไม่ต่ออายุแพ็กเกจ)'
WHERE "code" IN ('CREDIT_TOPUP', 'TOPUP');

-- A cost budget is now the monthly gate. Request-count limits remain available
-- for anti-abuse, but the seeded Pro package must not stop at 100 cheap turns.
UPDATE "packages"
SET "dailyLimit" = NULL, "monthlyLimit" = NULL
WHERE "code" = 'PRO';

CREATE TABLE "usage_wallets" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "includedBalanceUnits" INTEGER NOT NULL DEFAULT 0,
  "includedAllowanceUnits" INTEGER NOT NULL DEFAULT 0,
  "purchasedBalanceUnits" INTEGER NOT NULL DEFAULT 0,
  "purchasedAllowanceUnits" INTEGER NOT NULL DEFAULT 0,
  "periodStartedAt" TIMESTAMP(3),
  "periodEndsAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usage_transactions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amountUnits" INTEGER NOT NULL,
  "type" "UsageTxnType" NOT NULL,
  "bucket" "UsageBucket" NOT NULL DEFAULT 'INCLUDED',
  "referenceType" TEXT,
  "referenceId" TEXT,
  "note" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_wallets_userId_key" ON "usage_wallets"("userId");
CREATE INDEX "usage_transactions_userId_createdAt_idx"
  ON "usage_transactions"("userId", "createdAt");
CREATE INDEX "usage_transactions_referenceType_referenceId_idx"
  ON "usage_transactions"("referenceType", "referenceId");
CREATE INDEX "usage_transactions_type_createdAt_idx"
  ON "usage_transactions"("type", "createdAt");
ALTER TABLE "usage_wallets"
  ADD CONSTRAINT "usage_wallets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_transactions"
  ADD CONSTRAINT "usage_transactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_transactions"
  ADD CONSTRAINT "usage_transactions_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "horoscope_readings"
  ADD COLUMN "usageCostUnits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "messages"
  ADD COLUMN "usageCostUnits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ai_usage_logs"
  ADD COLUMN "cachedInputUsage" INTEGER,
  ADD COLUMN "usageCostUnits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pricingVersion" TEXT;

-- Convert the remaining legacy balance proportionally. A Pro user with 50/100
-- credits starts with 50% of the new Pro budget; a Free user with 3/3 starts at
-- 100%. Values above the old quota (renewals/top-ups) remain above 100%.
WITH effective_package AS (
  SELECT
    u."id" AS "userId",
    COALESCE(active_pkg."usageBudgetUnits", free_pkg."usageBudgetUnits", 0) AS budget,
    GREATEST(COALESCE(active_pkg."creditQuota", free_pkg."creditQuota", 1), 1) AS quota,
    active_sub."startsAt" AS period_start,
    active_sub."expiresAt" AS period_end,
    COALESCE(cw."balance", 0) AS credits
  FROM "users" u
  LEFT JOIN "credit_wallets" cw ON cw."userId" = u."id"
  LEFT JOIN LATERAL (
    SELECT s."packageId", s."startsAt", s."expiresAt"
    FROM "user_subscriptions" s
    JOIN "packages" p ON p."id" = s."packageId"
    WHERE s."userId" = u."id"
      AND s."status" = 'ACTIVE'
      AND (s."expiresAt" IS NULL OR s."expiresAt" > CURRENT_TIMESTAMP)
    ORDER BY CASE WHEN p."type" = 'PRO' THEN 0 ELSE 1 END, s."createdAt" DESC
    LIMIT 1
  ) active_sub ON TRUE
  LEFT JOIN "packages" active_pkg ON active_pkg."id" = active_sub."packageId"
  LEFT JOIN LATERAL (
    SELECT p."usageBudgetUnits", p."creditQuota"
    FROM "packages" p
    WHERE p."code" = 'FREE'
    LIMIT 1
  ) free_pkg ON TRUE
), converted AS (
  SELECT
    "userId",
    GREATEST(0, ROUND(credits::numeric * budget::numeric / quota::numeric)::integer) AS units,
    budget,
    period_start,
    period_end
  FROM effective_package
)
INSERT INTO "usage_wallets" (
  "id", "userId", "includedBalanceUnits", "includedAllowanceUnits",
  "purchasedBalanceUnits", "purchasedAllowanceUnits",
  "periodStartedAt", "periodEndsAt", "version", "updatedAt"
)
SELECT
  CONCAT('usage_wallet_', md5("userId" || ':cost-weighted-usage-v1')),
  "userId",
  LEAST(units, budget),
  budget,
  GREATEST(units - budget, 0),
  GREATEST(units - budget, 0),
  period_start,
  period_end,
  0,
  CURRENT_TIMESTAMP
FROM converted;

INSERT INTO "usage_transactions" (
  "id", "userId", "amountUnits", "type", "bucket",
  "referenceType", "referenceId", "note", "createdAt"
)
SELECT
  CONCAT('usage_migration_', md5(w."userId" || ':cost-weighted-usage-v1')),
  w."userId",
  w."includedBalanceUnits" + w."purchasedBalanceUnits",
  'MIGRATION'::"UsageTxnType",
  CASE
    WHEN w."purchasedBalanceUnits" > 0 THEN 'MIXED'::"UsageBucket"
    ELSE 'INCLUDED'::"UsageBucket"
  END,
  'MIGRATION',
  CONCAT('cost-weighted-usage-v1:', w."userId"),
  'แปลงเครดิตคงเหลือเป็นงบการใช้งาน AI',
  CURRENT_TIMESTAMP
FROM "usage_wallets" w
WHERE w."includedBalanceUnits" + w."purchasedBalanceUnits" > 0;
