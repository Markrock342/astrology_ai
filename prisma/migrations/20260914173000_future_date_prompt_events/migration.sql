-- Anonymous product telemetry for tuning future-date prompt detection.
-- Intentionally no question, user id, session id, IP, or selected date.
CREATE TABLE "future_date_prompt_events" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "future_date_prompt_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "future_date_prompt_events_createdAt_idx"
  ON "future_date_prompt_events" ("createdAt");

CREATE INDEX "future_date_prompt_events_trigger_action_createdAt_idx"
  ON "future_date_prompt_events" ("trigger", "action", "createdAt");
