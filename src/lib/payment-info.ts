import type { CmsPaymentInfo } from "@/lib/cms-keys";

/**
 * Avoid accepting payments before an administrator replaces the seeded example
 * bank details. This protects users from transferring to an invalid account.
 */
/** Copy shown while transfers are not accepted yet — CMS text, or the default. */
export function paymentUnavailableNote(info: CmsPaymentInfo): string {
  return (
    info.unavailableNote?.trim() ||
    "ระบบยังไม่เปิดรับชำระเงินผ่านการโอน กรุณาติดต่อทีมงานก่อนโอนเงิน"
  );
}

export function isPaymentInfoConfigured(info: CmsPaymentInfo): boolean {
  const accountDigits = info.accountNumber.replace(/\D/g, "");
  const accountName = info.accountName.trim().toLocaleLowerCase();

  return (
    accountDigits.length >= 8 &&
    !/^0+$/.test(accountDigits) &&
    !accountName.includes("ตัวอย่าง") &&
    !accountName.includes("example")
  );
}
