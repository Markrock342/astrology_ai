# Backend — Google auth + auto-create user (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- Google login พร้อมใช้ (เปิดอัตโนมัติเมื่อมี env `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`) และผู้ใช้ใหม่ถูก auto-create ตอน sign-in ครั้งแรก (สร้าง wallet + Free subscription + initial credit)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/auth/provisioning.ts` — `provisionUser()` (shared) + `ensureOAuthUser()` (auto-create/บล็อกบัญชี DISABLED)
- `src/server/auth/config.ts` — เพิ่ม `signIn` callback (auto-create Google + block disabled) และปรับ `jwt` callback ให้ resolve DB user id/role/status จากอีเมล (รองรับ JWT strategy ที่ไม่มี adapter)
- `src/app/api/auth/register/route.ts` — refactor ให้ใช้ `provisionUser()` ร่วมกัน (DRY)
- Google provider ยังผูกแบบ conditional-on-env ใน `src/auth.ts` (dev รันได้โดยไม่ต้องมี key)
- ผ่าน typecheck + lint

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ใช้ JWT strategy (คู่ Credentials) จึงไม่มี Prisma adapter → Google sign-in ไม่บันทึก user และ token.sub ไม่ใช่ id ของเรา
  - [วิธีที่ลองแก้]: auto-create ใน `signIn` callback + ตั้ง `token.sub` จาก DB user (lookup ด้วยอีเมล) ใน `jwt` callback

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- รอ PM: sign-in อีเมลเป็น magic-link หรือ อีเมล+รหัสผ่าน (ตอนนี้คง Credentials เดิม)
- ต้องตั้งค่า Google OAuth client (redirect URI) จริงในโปรดักชัน
- ยังไม่รวม Prisma adapter (ยังไม่จำเป็นเพราะใช้ JWT) — พิจารณาใหม่ถ้าเพิ่ม magic-link

## Checklist งานต่อไป (Next Steps)
- [ ] เปิด PR `be/google-auth` (stacked) → PM รีวิว
- [ ] ยืนยันรูปแบบ sign-in อีเมลกับ PM แล้ว implement ให้ตรง
- [ ] เพิ่ม test: auto-create ครั้งแรก / บล็อกบัญชี DISABLED
