-- Time-to-first-token per AI call.
--
-- The user asked "50 seconds per prompt — is that slow?" and the honest answer
-- was: we cannot tell WHERE those seconds go. latencyMs covers the whole call;
-- this column records when the first text token arrived, so slow-to-start
-- (prep/prefill — fixable) is distinguishable from long-answer-being-written
-- (a product choice about answer length).
--
-- Strictly additive: one nullable column.
ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "firstTokenMs" INTEGER;
