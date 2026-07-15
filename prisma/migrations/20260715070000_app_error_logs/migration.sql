-- Unhandled server errors, self-hosted.
--
-- Production 500s went to console.error on a serverless instance nobody was
-- watching; the first report of any breakage was a user complaint. This table
-- is where handle()'s catch-all now writes, and /admin/errors reads.
--
-- Strictly additive: one new table, one index.
CREATE TABLE "app_error_logs" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_error_logs_createdAt_idx" ON "app_error_logs" ("createdAt");
