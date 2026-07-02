-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('NATAL', 'TRANSIT');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "birth_profiles" ADD COLUMN     "birthCountry" TEXT NOT NULL DEFAULT 'ไทย',
ADD COLUMN     "birthDistrict" TEXT,
ADD COLUMN     "birthProvince" TEXT,
ADD COLUMN     "editCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "horoscope_categories" ADD COLUMN     "suggestedQuestions" JSONB;

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "mode" "ConversationMode" NOT NULL DEFAULT 'NATAL',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "provider" "AIProvider",
    "modelId" TEXT,
    "promptTemplateId" TEXT,
    "promptVersion" INTEGER,
    "creditCost" INTEGER NOT NULL DEFAULT 0,
    "status" "ReadingStatus" NOT NULL DEFAULT 'SUCCESS',
    "inputUsage" INTEGER,
    "outputUsage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_userId_createdAt_idx" ON "conversations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_categoryId_idx" ON "conversations"("categoryId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_idempotencyKey_key" ON "messages"("conversationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "horoscope_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
