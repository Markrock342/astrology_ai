# Backend — Google auth + auto-create user (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จและ merge แล้ว** (PR #3) — Google login (เมื่อมี env) + auto-create user ครั้งแรก; email+password ผ่าน Credentials
- ✅ FE sign-in ปรับแล้ว (`sign-in-form.tsx`, password toggle `75199eb`)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/auth/provisioning.ts` — `provisionUser()`, `ensureOAuthUser()`
- `src/server/auth/config.ts` — `signIn` + `jwt` callbacks (JWT strategy ไม่ใช้ Prisma adapter)
- `src/auth.ts` — Google provider แบบ conditional-on-env
- `src/app/api/auth/register/route.ts` — ใช้ `provisionUser()` ร่วมกัน
- End-to-end auth + birth profile (`1e7e868`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: JWT strategy ทำให้ Google ไม่ได้ user id จาก adapter
  - [วิธีที่ลองแก้]: auto-create ใน `signIn`; lookup email ใน `jwt` เพื่อตั้ง `token.sub`

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- รอ PM: magic-link vs email+password
- Production ต้องตั้ง Google OAuth redirect URI + env จริง
- ยังไม่มี test: auto-create / DISABLED block

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/google-auth` → merge แล้ว
- [ ] ยืนยันรูปแบบ sign-in อีเมลกับ PM
- [ ] test: `ensureOAuthUser` ครั้งแรก / บัญชี DISABLED
