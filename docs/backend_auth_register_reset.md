# Backend — Auth register + password reset + email verification

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ หน้า `/login` เดียว — `auth-card.tsx` แยกสมัคร vs เข้าสู่ระบบผ่าน `POST /api/auth/check-email`
- ✅ ปิด silent auto-create ใน Credentials — สมัครต้องเรียก `POST /api/auth/register`
- ✅ ลืมรหัสผ่าน + รีเซ็ต + **email verification** (verify/resend)
- ✅ Turnstile บน register/forgot-password
- ⚠️ **ส่งอีเมลจริง:** `mailer.ts` พร้อม Resend — ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` (+ `APP_BASE_URL`) บน `.env`/Vercel; ไม่มี key = dev fallback (log ใน console)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `PasswordResetToken` model + migration `20260703140000_password_reset_token`
- `src/server/auth/account-lookup.ts` — `getEmailAuthStatus()`
- `src/server/auth/password-reset-service.ts` — request/reset + token hash
- `src/server/auth/email-verification-service.ts` — token + resend
- `src/server/email/mailer.ts` — Resend HTTP API / dev console fallback
- API: `check-email`, `register`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`, `login`
- FE: `auth-card.tsx`, `verify-email-client.tsx`, forgot/reset ใน auth flow
- Tests: `tests/password-reset.test.ts`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Credentials auto-create ทำให้พิมพ์อีเมลผิดแล้วเกิดบัญชีใหม่เงียบๆ
  - [วิธีที่ลองแก้]: ลบ auto-create; สมัครผ่าน register API + UI ยืนยันรหัส 2 ครั้ง
- [ปัญหา]: forgot-password 500 (`prisma.passwordResetToken` undefined)
  - [วิธีที่ลองแก้]: `npx prisma generate` + restart dev server หลัง migration
- [ปัญหา]: "Too many requests" บน forgot-password
  - [วิธีที่ลองแก้]: rate limit register/forgot 5→10 ต่อนาที

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Production ยังไม่ได้ตั้ง `RESEND_API_KEY` → ลิงก์ reset/verify ไปที่ terminal เท่านั้นใน dev
- Gmail SMTP / nodemailer — ยังไม่ implement (ใช้ Resend เป็นทางหลัก)

## Checklist งานต่อไป (Next Steps)
- [ ] B4: ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` + `APP_BASE_URL` บน Vercel production
- [ ] smoke test: register → verify email → forgot → reset บน staging/prod
