-- CreateTable
CREATE TABLE "astrology_standard_terms" (
    "id" TEXT NOT NULL,
    "matchKey" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrology_standard_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "astrology_standard_terms_matchKey_key" ON "astrology_standard_terms"("matchKey");

-- CreateIndex
CREATE INDEX "astrology_standard_terms_enabled_sortOrder_idx" ON "astrology_standard_terms"("enabled", "sortOrder");
