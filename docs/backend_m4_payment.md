# Backend — Payment + Dashboard (M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Code ครบ** — manual payment, admin review, subscription cancel, admin dashboard
- ✅ **B3 rate-limit** — Upstash Redis + in-memory fallback (`src/lib/rate-limit.ts`)
- ✅ **Tests** — payment + rate-limit
- ⏳ **B4 ค้างการตั้งค่า** — env/domain/deploy ([backend_m4_deploy.md](./backend_m4_deploy.md))

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `payment-service.ts` — submit slip + admin approve/reject (+ audit + credits)
- `POST /api/payments/manual` · `GET /api/payments/me`
- `GET /api/admin/payments` · `POST /api/admin/payments/:id/review`
- `POST /api/me/subscription/cancel`
- `GET /api/admin/dashboard`
- `tests/payment-service.test.ts`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีบันทึกใหม่

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Go-live: env Vercel + domain + Resend + smoke ([deploy checklist](./backend_m4_deploy.md))

## Checklist งานต่อไป (Next Steps)
- [x] B3 Upstash rate-limit (code)
- [ ] รอบตั้งค่า .env / Vercel ([waitlist](./backend_m4_waitlist.md))
- [x] payment approve/reject tests
