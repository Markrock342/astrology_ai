# Backend — Google auth + auto-create user (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ปิด M2** — Google login (เมื่อมี env) + **อีเมล+รหัสผ่าน** สมัครตรง เก็บ `passwordHash` (Credentials, ไม่ใช้ magic-link)
- ✅ auto-create user ครั้งแรกทั้ง Google และ register flow
- ✅ FE: `auth-card.tsx` + `auth-panels.tsx` + Turnstile

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/auth/provisioning.ts` — `provisionUser()`, `ensureOAuthUser()`
- `src/server/auth/server-sign-in.ts` — credentials sign-in แยกจาก NextAuth handler
- `src/server/auth/email-verification-service.ts` — verify + resend
- `src/server/auth/turnstile.ts` — bot protection
- `src/auth.ts` — Google provider แบบ conditional-on-env
- `PUT /api/me/password` — ตั้ง/เปลี่ยนรหัสผ่าน (FE `settings-modals.tsx`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: JWT strategy ทำให้ Google ไม่ได้ user id จาก adapter
  - [วิธีที่ลองแก้]: auto-create ใน `signIn`; lookup email ใน `jwt` เพื่อตั้ง `token.sub`
- [ปัญหา]: บัญชีที่สมัครด้วย Google ไม่มี `passwordHash` → ล็อกอินรหัสผ่านไม่ได้
  - [วิธีที่ลองแก้]: ใช้ Google หรือ `PUT /api/me/password` ตั้งรหัสผ่านได้

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Production ต้องตั้ง Google OAuth redirect URI + env จริง (B4)
- ยังไม่มี test: auto-create / DISABLED block (B2)

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/google-auth` → merge แล้ว
- [x] ยืนยันรูปแบบ sign-in อีเมล: อีเมล+รหัสผ่าน (ไม่ใช้ magic-link)
- [x] `PUT /api/me/password` สำหรับตั้งรหัสผ่าน
- [ ] B2: test `ensureOAuthUser` ครั้งแรก / บัญชี DISABLED
