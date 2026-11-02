CREATE TABLE "email_deliveries" (
 "id" TEXT NOT NULL PRIMARY KEY, "providerId" TEXT, "recipient" TEXT NOT NULL,
 "subject" TEXT NOT NULL, "category" TEXT NOT NULL DEFAULT 'SYSTEM',
 "status" TEXT NOT NULL DEFAULT 'PENDING', "error" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "email_deliveries_providerId_key" ON "email_deliveries"("providerId");
CREATE INDEX "email_deliveries_createdAt_id_idx" ON "email_deliveries"("createdAt", "id");
CREATE INDEX "email_deliveries_status_createdAt_idx" ON "email_deliveries"("status", "createdAt");
CREATE INDEX "email_deliveries_category_createdAt_idx" ON "email_deliveries"("category", "createdAt");
CREATE TABLE "email_delivery_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "providerId" TEXT NOT NULL, "status" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "email_delivery_events_providerId_occurredAt_idx" ON "email_delivery_events"("providerId", "occurredAt");
