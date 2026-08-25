-- Point chat routing at current Gemini ids.
-- ละเอียด → gemini-3.7-flash (ALL plans); กระชับ → gemini-3.5-flash (ALL plans).
-- Lite stays as last-resort fallback. No deletes.
-- ALLOW_DESTRUCTIVE: updates seed AIProviderConfig rows only; keys/fallback unchanged.

BEGIN;

UPDATE "ai_provider_configs"
SET
  "modelId" = 'gemini-3.7-flash',
  "displayName" = 'ละเอียด — Gemini 3.7 Flash',
  "planScope" = 'ALL',
  "maxOutputTokens" = GREATEST("maxOutputTokens", 4096),
  "timeoutMs" = GREATEST("timeoutMs", 45000),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-gemini-pro';

UPDATE "ai_provider_configs"
SET
  "modelId" = 'gemini-3.5-flash',
  "displayName" = 'กระชับ — Gemini 3.5 Flash',
  "planScope" = 'ALL',
  "maxOutputTokens" = LEAST(GREATEST("maxOutputTokens", 1024), 2048),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-gemini-free';

UPDATE "ai_provider_configs"
SET
  "fallbackConfigId" = 'seed-gemini-free',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-gemini-pro'
  AND EXISTS (
    SELECT 1 FROM "ai_provider_configs" f WHERE f."id" = 'seed-gemini-free'
  );

COMMIT;
