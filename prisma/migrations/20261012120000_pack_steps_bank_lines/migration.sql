-- A (12 Oct 2026): the bank lines under "ชำระค่าบริการ…" were typed with Enter
-- and each became a numbered step. They join the step above as line breaks —
-- what Shift+Enter does in the form. Safe to run twice.
DO $$
DECLARE
  r RECORD;
  s TEXT;
  result TEXT[];
BEGIN
  FOR r IN SELECT "id", "upgradeSteps" FROM "packages" WHERE "questionPack" LOOP
    result := ARRAY[]::TEXT[];
    FOREACH s IN ARRAY r."upgradeSteps" LOOP
      IF array_length(result, 1) IS NOT NULL
         AND btrim(s) ~ '^(ธนาคาร|เลขที่บัญชี|เลขบัญชี|ชื่อบัญชี|พร้อมเพย์)\s*:' THEN
        result[array_length(result, 1)] := result[array_length(result, 1)] || E'\n' || btrim(s);
      ELSE
        result := result || s;
      END IF;
    END LOOP;
    UPDATE "packages" SET "upgradeSteps" = result, "updatedAt" = NOW()
    WHERE "id" = r."id" AND "upgradeSteps" IS DISTINCT FROM result;
  END LOOP;
END $$;
