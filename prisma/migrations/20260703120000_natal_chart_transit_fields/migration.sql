-- CreateEnum
CREATE TYPE "NatalChartStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "natal_charts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "birthProfileId" TEXT NOT NULL,
    "status" "NatalChartStatus" NOT NULL DEFAULT 'PENDING',
    "chartJson" JSONB,
    "note" TEXT,
    "computedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "natal_charts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "transitDate" TIMESTAMP(3),
ADD COLUMN     "transitTime" TEXT,
ADD COLUMN     "transitCountry" TEXT,
ADD COLUMN     "transitProvince" TEXT,
ADD COLUMN     "transitDistrict" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "natal_charts_userId_key" ON "natal_charts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "natal_charts_birthProfileId_key" ON "natal_charts"("birthProfileId");

-- AddForeignKey
ALTER TABLE "natal_charts" ADD CONSTRAINT "natal_charts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natal_charts" ADD CONSTRAINT "natal_charts_birthProfileId_fkey" FOREIGN KEY ("birthProfileId") REFERENCES "birth_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
