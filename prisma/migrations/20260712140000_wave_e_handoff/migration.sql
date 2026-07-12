-- Wave E handoff: payment notify fields, package credit-only top-up, requested package code

ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "creditOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "packageCode" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "notifyError" TEXT;
