-- Transparent, user-controlled shared context across horoscope conversations.
-- Resetting memory advances a boundary; it never destroys chat history.
ALTER TABLE "users"
  ADD COLUMN "aiMemoryEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "aiMemoryResetAt" TIMESTAMPTZ;
