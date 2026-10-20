-- Keep the published/default persona aligned with the product's neutral
-- "อาจารย์โหราศาสตร์" identity. Target only the default persona so custom
-- category personas remain under admin control.
-- ALLOW_DESTRUCTIVE: targeted, idempotent copy replacement on persona.default only; no rows or user data are removed.
UPDATE "prompt_templates"
SET
  "name" = REPLACE("name", 'แม่หมอ', 'อาจารย์โหราศาสตร์'),
  "content" = REPLACE(
    REPLACE(
      REPLACE("content", 'โหราจารย์หญิง', 'ผู้เชี่ยวชาญโหราศาสตร์ไทย'),
      'แม่หมอ',
      'อาจารย์'
    ),
    'ค่ะ/คะ',
    'ถ้อยคำสุภาพที่ไม่ระบุเพศ'
  ),
  "draftContent" = CASE
    WHEN "draftContent" IS NULL THEN NULL
    ELSE REPLACE(
      REPLACE(
        REPLACE("draftContent", 'โหราจารย์หญิง', 'ผู้เชี่ยวชาญโหราศาสตร์ไทย'),
        'แม่หมอ',
        'อาจารย์'
      ),
      'ค่ะ/คะ',
      'ถ้อยคำสุภาพที่ไม่ระบุเพศ'
    )
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'persona.default';
