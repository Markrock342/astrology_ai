# Backend — Payment + Dashboard (M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Code ครบบน main** — manual payment, admin review, subscription cancel, admin dashboard
- 🟡 **B4 ค้าง:** production env + migrate/seed prod + smoke test

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/payment/payment-service.ts` — submit slip + admin approve/reject (+ audit)
- `POST /api/payments/manual` · `GET /api/payments/me`
- `GET /api/admin/payments` · `POST /api/admin/payments/:id/review`
- `POST /api/me/subscription/cancel` — ยกเลิก Pro
- `src/server/admin/dashboard-admin-service.ts` — `GET /api/admin/dashboard` (users, revenue, AI cost)
- FE: `payment-submit-card.tsx`, `account-view.tsx`, admin payments + dashboard pages

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีบันทึกใหม่ในรอบนี้

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Rate-limit ยัง in-memory — ไม่รอด multi-instance (B3, รอ PM)
- Go-live checklist: env Vercel, backup, smoke test (B4)
- เนื้อหา legal จริง — ฝั่ง FE F4 (หน้า scaffold มีแล้ว)

## Checklist งานต่อไป (Next Steps)
- [ ] B3: Redis/Upstash rate-limit (หลัง PM ตัดสินใจ)
- [ ] B4: ตั้ง env production, migrate+seed, smoke test end-to-end
- [ ] B2: test payment approve → credits/subscription ถูกต้อง
