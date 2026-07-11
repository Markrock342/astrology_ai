# Backend — Payment + Dashboard (M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Code ครบ** — manual payment, admin review, subscription cancel, admin dashboard
- ✅ **Tests** — `tests/payment-service.test.ts` (approve/reject/duplicate)
- 🟡 **B4 ค้างการตั้งค่า** — ดู [backend_m4_deploy.md](./backend_m4_deploy.md)
- ⏸️ **B3 รอ PM** — [backend_m4_waitlist.md](./backend_m4_waitlist.md)

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
- Rate-limit in-memory จนกว่า PM จะเลือก Upstash (B3)
- Go-live: env Vercel + migrate prod + manual smoke ([deploy checklist](./backend_m4_deploy.md))

## Checklist งานต่อไป (Next Steps)
- [ ] PM → B3 rate-limit decision
- [ ] BN → B4 deploy checklist บน production
- [x] payment approve/reject tests
