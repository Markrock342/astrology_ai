import type { CmsPaymentInfo } from "@/lib/cms-keys";

/**
 * Avoid accepting payments before an administrator replaces the seeded example
 * bank details. This protects users from transferring to an invalid account.
 */
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
