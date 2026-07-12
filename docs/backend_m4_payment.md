# Backend — Payment + Dashboard (M4 + Wave E)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Code ครบ** — manual payment, admin review, subscription cancel, admin dashboard
- ✅ **B3 rate-limit** — Upstash Redis + in-memory fallback (`src/lib/rate-limit.ts`)
- ✅ **Wave E** — notify persistence, credit top-up, `packageCode` on submit
- 🟡 **Go-live manual** — smoke + OAuth redirect ([backend_m4_deploy.md](./backend_m4_deploy.md))

## งานที่เพิ่งทำเสร็จ (Recently Completed) — Wave E
- `Payment.notifiedAt` / `notifyError` — บันทึกผลส่งอีเมลหลัง approve/reject
- `Package.creditOnly` + seed `CREDIT_TOPUP` (เติมเครดิต 50 / 99฿ ไม่แตะ subscription)
- `Payment.packageCode` — user ระบุแพ็กตอนส่งสลิป; admin review ใช้/override ได้
- `reviewPayment` — branch `creditOnly`: `addCredits` เท่านั้น ไม่สร้าง subscription ใหม่
- Admin list ส่ง `notifiedAt`, `notifyError`, `packageCode`
- Tests: `payment-service.test.ts`, `payment-notify.test.ts`

## งานที่เสร็จก่อนหน้า (M4)
- `payment-service.ts` — submit slip + CAS approve/reject (+ audit + credits)
- `POST /api/payments/manual` · `GET /api/payments/me` · private slip proof
- `GET /api/admin/payments` · `PATCH /api/admin/payments/:id/review`
- `POST /api/me/subscription/cancel` · `GET /api/admin/dashboard`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีบันทึกใหม่

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Ops: Resend domain + `EMAIL_FROM` (PM) — โค้ด persist notify พร้อมแล้ว
- `CREDIT_TOPUP` ต้องมีใน DB — รัน `npm run db:seed` หลังตั้ง `SEED_ADMIN_PASSWORD` ที่ไม่ใช่ค่า default
- Wave E2: `Payment.packageId` FK, receipt, retention cron — ดู `BE_ASSIGN.md` § E2

## Checklist งานต่อไป (Next Steps)
- [x] B3 Upstash rate-limit (code)
- [x] Wave E payment notify + top-up
- [ ] Merge `be/wave-e-handoff` → `main`
- [ ] FE: badge `notifyError` (FE-E2.4), ฟอร์มเลือก `packageCode` (FE-E1.3)
