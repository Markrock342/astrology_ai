# Backend — Auth register + password reset

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ หน้า `/login` เดียว — แยก **สมัคร** (อีเมลใหม่ + รหัส 2 ครั้ง) vs **เข้าสู่ระบบ** (รหัสเดียว) ผ่าน `POST /api/auth/check-email`
- ✅ ปิด silent auto-create ใน Credentials — สมัครต้องเรียก `POST /api/auth/register` ชัดเจน
- ✅ ลืมรหัสผ่าน: `/forgot-password` → token ใน DB → `/reset-password?token=...`
- ⚠️ **ยังไม่ได้เชื่อมส่งอีเมลจริง** — ใช้ dev fallback (log ลิงก์รีเซ็ตใน server console) จนกว่าจะตั้ง `RESEND_API_KEY` + `EMAIL_FROM`

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
- **อีเมลยังไม่เชื่อมจริง** — `mailer.ts` มี path Resend พร้อมแล้ว แต่ยังไม่มี `RESEND_API_KEY` ใน `.env` / Vercel → ลิงก์รีเซ็ตไปที่ terminal เท่านั้น
- Gmail SMTP / nodemailer — **ยังไม่ implement** (เป็นงานอนาคตถ้าไม่ใช้ Resend)
- บัญชี Google-only ยังไม่มี flow ตั้งรหัสผ่าน (ใช้ Google หรือ admin)
- หลังเพิ่ม model `PasswordResetToken` ต้อง `npx prisma generate` และ restart dev server (มิฉะนั้น forgot-password 500)

## Checklist งานต่อไป (Next Steps)
- [ ] **เชื่อมส่งอีเมลจริง:** ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` (+ `APP_BASE_URL`) บน `.env` / Vercel
- [ ] (optional) Gmail SMTP ผ่าน nodemailer ถ้าไม่ใช้ Resend
- [ ] (optional) `PUT /api/me/password` สำหรับ Google-only → ตั้งรหัสผ่านได้
