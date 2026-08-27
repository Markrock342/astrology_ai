-- Remove the remaining legacy credit wording from the persisted top-up product.
-- ALLOW_DESTRUCTIVE: copy-only update for the single known top-up package row.

UPDATE "packages"
SET
  "name" = 'เติม usage',
  "description" = 'เติม usage เพิ่มสำหรับสมาชิก Pro (ไม่ต่ออายุแพ็กเกจ)',
  "upgradeSteps" = ARRAY[
    'โอนเงินตามยอดเติม usage (99 บาท)',
    'เลือกแพ็กเกจ "เติม usage" ตอนส่งสลิป',
    'แอดมินตรวจสอบและเพิ่ม usage ให้บัญชีของคุณ'
  ]::TEXT[]
WHERE "code" IN ('CREDIT_TOPUP', 'TOPUP');
