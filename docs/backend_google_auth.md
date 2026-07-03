# Backend — Google auth + auto-create user (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ปิด M2** — Google login (เมื่อมี env) + **อีเมล+รหัสผ่าน** สมัครตรง เก็บ `passwordHash` ใน DB เรา (Credentials, ไม่ใช้ magic-link)
- ✅ auto-create user ครั้งแรกทั้ง Google และอีเมล
- ✅ FE sign-in (`sign-in-form.tsx`)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- ตัดสินใจ auth อีเมล: สมัครกับเราโดยตรง เก็บลง PostgreSQL — ไม่ทำ magic-link
- `src/server/auth/provisioning.ts` — `provisionUser()`, `ensureOAuthUser()`
- `src/server/auth/config.ts` — Credentials + Google callbacks
- `src/auth.ts` — Google provider แบบ conditional-on-env

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: JWT strategy ทำให้ Google ไม่ได้ user id จาก adapter
  - [วิธีที่ลองแก้]: auto-create ใน `signIn`; lookup email ใน `jwt` เพื่อตั้ง `token.sub`
- [ปัญหา]: บัญชีที่สมัครด้วย Google ไม่มี `passwordHash` → ล็อกอินรหัสผ่านไม่ได้
  - [วิธีที่ลองแก้]: ยอมรับเป็น known limitation M2; account linking / set-password เป็นงานถัดไป

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Production ต้องตั้ง Google OAuth redirect URI + env จริง
- ยังไม่มี test: auto-create / DISABLED block
- ยังไม่มี flow ตั้งรหัสผ่านสำหรับบัญชีที่สมัครด้วย Google ก่อน

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/google-auth` → merge แล้ว
- [x] ยืนยันรูปแบบ sign-in อีเมล: อีเมล+รหัสผ่าน (ไม่ใช้ magic-link)
- [ ] test: `ensureOAuthUser` ครั้งแรก / บัญชี DISABLED
- [ ] (optional) `PUT /api/me/password` สำหรับ Google-only accounts
