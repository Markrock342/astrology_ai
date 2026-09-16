-- Audit trail of exactly what each reading sent to the model: chart blocks,
-- transit window, knowledge chunks, template versions, full prompts.
ALTER TABLE "horoscope_readings" ADD COLUMN "promptTraceJson" JSONB;
