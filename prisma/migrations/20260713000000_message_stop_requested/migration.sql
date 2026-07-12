-- Explicit stop signal for in-flight assistant generation.
-- Polled by the generating request so a stop still works when the stop call
-- lands on a different serverless instance than the one streaming.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "stopRequested" BOOLEAN NOT NULL DEFAULT false;
