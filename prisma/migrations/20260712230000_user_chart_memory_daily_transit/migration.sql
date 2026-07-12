-- User chart memory + daily transit cache for fast chat prompts

CREATE TABLE "user_chart_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryJson" JSONB NOT NULL,
    "birthHash" TEXT NOT NULL,
    "source" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_chart_memories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_chart_memories_userId_key" ON "user_chart_memories"("userId");
CREATE INDEX "user_chart_memories_birthHash_idx" ON "user_chart_memories"("birthHash");

ALTER TABLE "user_chart_memories"
  ADD CONSTRAINT "user_chart_memories_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "daily_transit_caches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "chartJson" JSONB NOT NULL,
    "source" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_transit_caches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_transit_caches_userId_dateKey_key" ON "daily_transit_caches"("userId", "dateKey");
CREATE INDEX "daily_transit_caches_dateKey_idx" ON "daily_transit_caches"("dateKey");

ALTER TABLE "daily_transit_caches"
  ADD CONSTRAINT "daily_transit_caches_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
