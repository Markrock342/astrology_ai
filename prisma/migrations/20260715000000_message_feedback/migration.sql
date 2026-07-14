-- Thumbs up/down on an assistant answer.
--
-- The buttons already existed, but they wrote to localStorage and nowhere else:
-- a user could tell us an answer was wrong and we would never find out. This is
-- where that signal lands now.
--
-- Strictly additive — a new enum and a new table. Nothing existing is touched.
CREATE TYPE "FeedbackValue" AS ENUM ('UP', 'DOWN');

CREATE TABLE "message_feedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" "FeedbackValue" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("id")
);

-- One verdict per person per answer: voting again changes your mind, it does not
-- stuff the ballot.
CREATE UNIQUE INDEX "message_feedback_messageId_userId_key"
  ON "message_feedback" ("messageId", "userId");

-- The admin view reads "the bad answers, newest first".
CREATE INDEX "message_feedback_value_createdAt_idx"
  ON "message_feedback" ("value", "createdAt");

ALTER TABLE "message_feedback"
  ADD CONSTRAINT "message_feedback_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_feedback"
  ADD CONSTRAINT "message_feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
