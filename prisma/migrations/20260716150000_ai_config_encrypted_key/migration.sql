-- AlterTable: allow admin-managed encrypted API keys on AIProviderConfig.
-- secretReference becomes optional (env fallback); encryptedApiKey stores
-- AES-256-GCM ciphertext; keyLast4 is for masked UI display only.

ALTER TABLE "ai_provider_configs" ALTER COLUMN "secretReference" DROP NOT NULL;

ALTER TABLE "ai_provider_configs" ADD COLUMN "encryptedApiKey" TEXT;
ALTER TABLE "ai_provider_configs" ADD COLUMN "keyLast4" TEXT;
