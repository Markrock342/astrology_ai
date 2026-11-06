import { describe, expect, it } from "vitest";
import { verificationEmail, passwordResetEmail, paymentReviewedEmail } from "@/server/email/templates";

describe("owner email templates", () => {
  it("uses the real verification/reset lifetime and matching HTML/plain links", () => {
    for (const [mail, label, ttl, url] of [
      [verificationEmail("เอ", "https://horasard.com/verify-email?token=t&x=1",24), "ยืนยันอีเมลของฉัน", "24 ชั่วโมง", "verify-email?token=t"],
      [passwordResetEmail("เอ", "https://horasard.com/reset-password?token=t",30), "ตั้งรหัสผ่านใหม่", "30 นาที", "reset-password?token=t"],
    ] as const) {
      expect(mail.subject).toMatch(/^\[HORASARD\]/);
      expect(mail.text).toContain(ttl);expect(mail.html).toContain(ttl);
      expect(mail.html).toContain(label);expect(mail.text).toContain(url);expect(mail.html).toContain(url);
      expect(mail.text).toContain("facebook.com/horasard");
      expect(mail.text).not.toMatch(/\[(ชื่อผู้ใช้|จำนวน|URL_)/);
    }
  });
  it("shows the immutable payment reference, package, amount and Bangkok transfer time", () => {
    const mail=paymentReviewedEmail({paymentId:"pay-123",userName:"เอ",packageName:"90 คำถาม",amount:99,approved:true,paidAt:new Date("2026-11-06T08:00:00Z"),accountUrl:"https://horasard.com/account"});
    for (const body of [mail.text,mail.html]) {
      expect(body).toContain("pay-123");expect(body).toContain("90 คำถาม");expect(body).toContain("99 บาท");expect(body).toContain("15:00");
    }
    expect(mail.subject).toContain("ชำระเงินสำเร็จ");
  });
  it("escapes untrusted names/notes, preserves rejection reason and avoids urging another transfer", () => {
    const mail=paymentReviewedEmail({paymentId:"pay-123",userName:"<script>x</script>",packageName:"40 คำถาม",amount:50,approved:false,paidAt:new Date(),note:'ยอดไม่ตรง <img src=x onerror="x">',accountUrl:"https://horasard.com/account"});
    expect(mail.subject).toContain("การชำระเงินไม่สำเร็จ");
    expect(mail.text).toContain("ยอดไม่ตรง");expect(mail.text).toContain("ไม่ต้องโอนซ้ำ");
    expect(mail.html).not.toContain("<script>");expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
