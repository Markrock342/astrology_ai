-- Free gets 5 questions to try (A's table; asked for on 12 Oct 2026).
-- One question = 15,000 units (UNITS_PER_QUESTION). New sign-ups get it;
-- existing wallets keep what they have.
UPDATE "packages" SET "usageBudgetUnits" = 75000, "updatedAt" = NOW()
WHERE "code" = 'FREE' AND "usageBudgetUnits" <> 75000;
