-- Drop unused category → AI config FK (dead knob; routing uses AIProviderConfig.categoryId).
ALTER TABLE "horoscope_categories" DROP CONSTRAINT IF EXISTS "horoscope_categories_aiConfigId_fkey";
ALTER TABLE "horoscope_categories" DROP COLUMN IF EXISTS "aiConfigId";
