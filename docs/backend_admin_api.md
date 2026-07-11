# Backend — Admin API users / categories / packages (M2+)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M2 ปิดแล้ว** — users (list/detail/status/credits/subscription) + CRUD categories/packages
- ✅ **M4 ขยายแล้ว** — payment review, dashboard, FAQ, announcements, settings, audit logs (ดู [backend_m4_payment.md](./backend_m4_payment.md), [backend_ai_admin.md](./backend_ai_admin.md))
- ทุก mutation `requireAdmin()` + `writeAudit()`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/admin/user-admin-service.ts` — users CRUD + credits (ledger) + subscription + role
- `src/server/admin/catalog-admin-service.ts` — categories/packages CRUD + `listPublicPackages()`
- `src/server/admin/dashboard-admin-service.ts` — KPIs + AI cost estimate (`GET /api/admin/dashboard`)
- `src/server/payment/payment-service.ts` — manual payment + admin review
- Routes: `/api/admin/users/*`, `categories/*`, `packages/*`, `payments/*`, `dashboard`
- FE: admin shell ครบทุกหน้า (`3796e65`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Prisma Json typing ใน category create/update
  - [วิธีที่ลองแก้]: explicit input types + `Unchecked*Input` cast

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `setUserSubscription` / payment approve — ตรวจ business rule การเติมเครดิตเมื่อเปิด Pro (ทดสอบใน B2)
- ยังไม่มี automated test admin auth / audit (B2)

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/admin-api` → merge แล้ว
- [x] payments + dashboard (M4 code)
- [ ] B2: test `requireAdmin` + `writeAudit` ทุก mutation
