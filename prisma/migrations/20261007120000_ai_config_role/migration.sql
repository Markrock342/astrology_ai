-- CreateEnum
CREATE TYPE "AIConfigRole" AS ENUM ('DETAILED', 'BRIEF', 'BACKUP');

-- AlterTable
ALTER TABLE "ai_provider_configs" ADD COLUMN "role" "AIConfigRole";
