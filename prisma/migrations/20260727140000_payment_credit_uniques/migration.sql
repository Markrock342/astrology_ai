-- Defense-in-depth for the payment/credit flow (audit P2). Both are additive
-- unique indexes; verified there are zero existing violations before shipping.

-- At most one PENDING payment per user — backstops the app-level count guard
-- against a concurrent double-submit that would create two grantable rows.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_user_pending_unique"
  ON "payments" ("userId")
  WHERE "status" = 'PENDING';

-- One credit grant per (referenceType, referenceId, type): a replayed grant for
-- the same payment fails at the DB even if the status CAS is ever weakened.
CREATE UNIQUE INDEX IF NOT EXISTS "credit_txn_reference_type_unique"
  ON "credit_transactions" ("referenceType", "referenceId", "type")
  WHERE "referenceType" IS NOT NULL AND "referenceId" IS NOT NULL;
