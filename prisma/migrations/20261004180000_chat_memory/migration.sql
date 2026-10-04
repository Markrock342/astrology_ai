-- Rolling summary of a chat beyond the turns sent as history.
ALTER TABLE "conversations" ADD COLUMN "summary" TEXT;
ALTER TABLE "conversations" ADD COLUMN "summaryCovers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN "summaryAt" TIMESTAMP(3);

-- Facts the user told the chat about themselves, kept across chats.
CREATE TABLE "user_memory_facts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceConversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_memory_facts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_memory_facts_userId_updatedAt_idx" ON "user_memory_facts"("userId", "updatedAt");
ALTER TABLE "user_memory_facts" ADD CONSTRAINT "user_memory_facts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
