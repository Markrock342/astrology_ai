# Backend — Auth register + password reset

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ หน้า `/login` เดียว — แยก **สมัคร** (อีเมลใหม่ + รหัส 2 ครั้ง) vs **เข้าสู่ระบบ** (รหัสเดียว) ผ่าน `POST /api/auth/check-email`
- ✅ ปิด silent auto-create ใน Credentials — สมัครต้องเรียก `POST /api/auth/register` ชัดเจน
- ✅ ลืมรหัสผ่าน: `/forgot-password` → token ใน DB → `/reset-password?token=...`
- ⚠️ ส่งอีเมลจริง: รอ `RESEND_API_KEY` — ตอนนี้ dev fallback (log ลิงก์ใน console)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `PasswordResetToken` model + migration `20260703140000_password_reset_token`
- `src/server/auth/account-lookup.ts` — `getEmailAuthStatus()`
- `src/server/auth/password-reset-service.ts` — request/reset + token hash
- `src/server/email/mailer.ts` — Resend-ready, dev console fallback
- API: `check-email`, `forgot-password`, `reset-password`; `register` name optional
- FE: `sign-in-form.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx`
- Tests: `tests/password-reset.test.ts`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Credentials auto-create ทำให้พิมพ์อีเมลผิดแล้วเกิดบัญชีใหม่เงียบๆ
  - [วิธีที่ลองแก้]: ลบ auto-create; สมัครผ่าน register API + UI ยืนยันรหัส 2 ครั้ง

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ยังไม่มี `RESEND_API_KEY` — production ต้องตั้ง env ก่อนส่งเมลจริง
- บัญชี Google-only ยังไม่มี flow ตั้งรหัสผ่าน (ใช้ Google หรือ admin)

## Checklist งานต่อไป (Next Steps)
- [ ] ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` บน Vercel
- [ ] (optional) `PUT /api/me/password` สำหรับ Google-only → ตั้งรหัสผ่านได้
