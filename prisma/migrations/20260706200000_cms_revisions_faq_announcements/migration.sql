-- CMS: revision history, draft/publish, announcements, FAQ, SEO-ready settings

CREATE TYPE "ContentEntityType" AS ENUM ('APP_SETTING', 'PROMPT_TEMPLATE', 'KNOWLEDGE_DOC', 'FAQ_ITEM');
CREATE TYPE "RevisionAction" AS ENUM ('DRAFT_SAVE', 'PUBLISH', 'RESTORE');
CREATE TYPE "AnnouncementTone" AS ENUM ('INFO', 'WARNING', 'PROMO', 'DANGER');

ALTER TABLE "app_settings"
  ADD COLUMN "draftValueJson" JSONB,
  ADD COLUMN "draftUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "draftUpdatedById" TEXT;

ALTER TABLE "prompt_templates"
  ADD COLUMN "draftContent" TEXT,
  ADD COLUMN "draftUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "draftUpdatedById" TEXT;

ALTER TABLE "knowledge_docs"
  ADD COLUMN "draftTitle" TEXT,
  ADD COLUMN "draftContent" TEXT,
  ADD COLUMN "draftUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "draftUpdatedById" TEXT;

CREATE TABLE "content_revisions" (
  "id" TEXT NOT NULL,
  "entityType" "ContentEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "action" "RevisionAction" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_announcements" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "tone" "AnnouncementTone" NOT NULL DEFAULT 'INFO',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "linkUrl" TEXT,
  "linkLabel" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "faq_items" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "draftQuestion" TEXT,
  "draftAnswer" TEXT,
  "draftUpdatedAt" TIMESTAMP(3),
  "draftUpdatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_revisions_entityType_entityId_createdAt_idx"
  ON "content_revisions"("entityType", "entityId", "createdAt");

CREATE INDEX "site_announcements_enabled_sortOrder_idx"
  ON "site_announcements"("enabled", "sortOrder");

CREATE INDEX "faq_items_enabled_sortOrder_idx"
  ON "faq_items"("enabled", "sortOrder");

ALTER TABLE "app_settings"
  ADD CONSTRAINT "app_settings_draftUpdatedById_fkey"
  FOREIGN KEY ("draftUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prompt_templates"
  ADD CONSTRAINT "prompt_templates_draftUpdatedById_fkey"
  FOREIGN KEY ("draftUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_docs"
  ADD CONSTRAINT "knowledge_docs_draftUpdatedById_fkey"
  FOREIGN KEY ("draftUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "content_revisions"
  ADD CONSTRAINT "content_revisions_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faq_items"
  ADD CONSTRAINT "faq_items_draftUpdatedById_fkey"
  FOREIGN KEY ("draftUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
