-- Public CMS media (logos, landing, OG) stored in-DB for host-agnostic serving.
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_assets_createdAt_idx" ON "media_assets"("createdAt");
