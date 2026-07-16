-- Allow admin-created OpenAI-compatible providers to target a custom endpoint.
ALTER TABLE "ai_provider_configs" ADD COLUMN "baseUrl" TEXT;
