-- ALLOW_DESTRUCTIVE: drops dead horoscope_categories.aiConfigId only. Admin
-- never wrote usable values here; chat routing uses AIProviderConfig.categoryId.
-- Column was unused UI leftover — safe to remove; no live traffic depended on it.

-- Drop unused category → AI config FK (dead knob; routing uses AIProviderConfig.categoryId).
ALTER TABLE "horoscope_categories" DROP CONSTRAINT IF EXISTS "horoscope_categories_aiConfigId_fkey";
ALTER TABLE "horoscope_categories" DROP COLUMN IF EXISTS "aiConfigId";
