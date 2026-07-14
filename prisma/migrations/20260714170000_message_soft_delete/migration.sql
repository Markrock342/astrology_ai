-- Soft delete for messages.
--
-- Editing a question (or regenerating an answer) ran a deleteMany over every
-- message after it: the rest of the conversation was destroyed, with no undo and
-- no trace. Superseded turns are now marked instead of erased.
--
-- Strictly additive: one nullable column and one index. `prisma migrate diff`
-- also wanted to drop and recreate three unrelated indexes (pre-existing drift
-- between the migration history and the live database) — deliberately NOT
-- included here. Dropping a live index just to re-add it is downtime this change
-- has no business causing.
--
-- Safe to apply BEFORE the code that reads it ships: existing queries never
-- mention deletedAt, so nothing in flight is affected.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "messages_conversationId_deletedAt_createdAt_idx"
  ON "messages" ("conversationId", "deletedAt", "createdAt");
