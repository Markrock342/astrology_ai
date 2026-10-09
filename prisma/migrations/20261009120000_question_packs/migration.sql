-- Question packs (9 Oct 2026): packs of questions bought one at a time, which
-- may expire. Columns only — the packs themselves are made in Admin → แพ็กเกจ.

CREATE TYPE "PackExpiryMode" AS ENUM ('DEFAULT', 'NONE', 'DAYS', 'DATE');

ALTER TABLE "packages"
  ADD COLUMN "questionPack" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "expiryMode" "PackExpiryMode" NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN "expiryDays" INTEGER,
  ADD COLUMN "expiresOn" TIMESTAMP(3);

ALTER TABLE "usage_wallets" ADD COLUMN "purchasedExpiresAt" TIMESTAMP(3);
