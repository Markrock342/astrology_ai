-- Payment slips stored in the database when no Blob store is configured.
CREATE TABLE "payment_slips" (
    "pathname" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_slips_pkey" PRIMARY KEY ("pathname")
);

CREATE INDEX "payment_slips_userId_idx" ON "payment_slips"("userId");

ALTER TABLE "payment_slips" ADD CONSTRAINT "payment_slips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
