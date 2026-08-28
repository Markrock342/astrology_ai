import { describe, expect, it } from "vitest";
import { isPaymentInfoConfigured } from "@/lib/payment-info";

const base = {
  title: "ชำระเงิน",
  bankName: "ธนาคารกสิกรไทย",
  accountName: "บริษัท ฮอราสาด จำกัด",
  accountNumber: "123-4-56789-0",
  amountNote: "โอนตามยอดที่แสดง",
  steps: [],
};

describe("isPaymentInfoConfigured", () => {
  it("allows a real-looking configured bank account", () => {
    expect(isPaymentInfoConfigured(base)).toBe(true);
  });

  it("blocks the seeded example account", () => {
    expect(
      isPaymentInfoConfigured({
        ...base,
        accountName: "บริษัท ตัวอย่าง จำกัด",
        accountNumber: "000-0-00000-0",
      }),
    ).toBe(false);
  });
});
