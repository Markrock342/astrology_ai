-- Content the team asked for on 12 Oct 2026 (the production database is not
-- reachable from outside, so it ships as a migration). Safe to run twice.

-- 1. Pricing section copy (A's wording), in the published value and any draft.
UPDATE "app_settings"
SET "valueJson" = "valueJson" || jsonb_build_object(
      'title', 'เลือกแพ็กเกจที่เหมาะกับคุณ',
      'subtitle', 'เปิดดวงชะตาฟรีทันทีที่สมัคร! และเมื่อพร้อมเจาะลึกทุกข้อสงสัย เลือกแพ็กเกจเพื่อพูดคุย ปรึกษา และรับคำทำนายแบบส่วนตัว เพื่อเป็นแนวทางในการตัดสินใจของคุณได้ตลอด 24 ชั่วโมง'),
    "draftValueJson" = CASE WHEN "draftValueJson" IS NULL THEN NULL ELSE "draftValueJson" || jsonb_build_object(
      'title', 'เลือกแพ็กเกจที่เหมาะกับคุณ',
      'subtitle', 'เปิดดวงชะตาฟรีทันทีที่สมัคร! และเมื่อพร้อมเจาะลึกทุกข้อสงสัย เลือกแพ็กเกจเพื่อพูดคุย ปรึกษา และรับคำทำนายแบบส่วนตัว เพื่อเป็นแนวทางในการตัดสินใจของคุณได้ตลอด 24 ชั่วโมง') END
WHERE "key" = 'landing_pricing_section';

-- 2. Question-pack purchase steps: a step that ends with ":" (a heading such
-- as "ขั้นตอนการยืนยันสิทธิ์:") takes in the steps after it as lines of the
-- same step — what Shift+Enter now does in the form — until a "หมายเหตุ" step
-- or another heading.
DO $$
DECLARE
  r RECORD;
  s TEXT;
  merged TEXT;
  result TEXT[];
BEGIN
  FOR r IN SELECT "id", "upgradeSteps" FROM "packages" WHERE "questionPack" LOOP
    result := ARRAY[]::TEXT[];
    merged := NULL;
    FOREACH s IN ARRAY r."upgradeSteps" LOOP
      IF merged IS NOT NULL AND btrim(s) NOT LIKE 'หมายเหตุ%' AND btrim(s) !~ ':$' THEN
        merged := merged || E'\n' || btrim(s);
      ELSE
        IF merged IS NOT NULL THEN
          result := result || merged;
          merged := NULL;
        END IF;
        IF btrim(s) ~ ':$' THEN
          merged := btrim(s);
        ELSE
          result := result || s;
        END IF;
      END IF;
    END LOOP;
    IF merged IS NOT NULL THEN
      result := result || merged;
    END IF;
    UPDATE "packages" SET "upgradeSteps" = result, "updatedAt" = NOW()
    WHERE "id" = r."id" AND "upgradeSteps" IS DISTINCT FROM result;
  END LOOP;
END $$;
