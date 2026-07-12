# Backend — Admin API users / categories / packages (M2+)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M2 ปิดแล้ว** — users (list/detail/status/credits/subscription) + CRUD categories/packages
- ✅ **M4 ขยายแล้ว** — payment review, dashboard, FAQ, announcements, settings, audit logs
- ✅ **Wave E** — `DELETE /api/admin/users/[id]` (SUPER_ADMIN + audit); payment list ส่ง `notifiedAt`/`notifyError`
- ทุก mutation `requireAdmin()` (ลบ user = `requireSuperAdmin()`) + `writeAudit()`

## งานที่เพิ่งทำเสร็จ (Recently Completed) — Wave E
- `DELETE /api/admin/users/[id]` — `deleteUserAccountAsAdmin` + ลบ slip blobs
- `GET /api/admin/payments` — เพิ่ม `notifiedAt`, `notifyError`, `packageCode`
- `Package.creditOnly` ใน catalog admin + public packages API

## งานที่เสร็จก่อนหน้า
- `user-admin-service.ts` · `catalog-admin-service.ts` · `dashboard-admin-service.ts`
- `payment-service.ts` — manual payment + admin review
- Routes: `/api/admin/users/*`, `categories/*`, `packages/*`, `payments/*`, `dashboard`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Prisma Json typing ใน category create/update
  - [วิธีที่ลองแก้]: explicit input types + `Unchecked*Input` cast

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- FE ยังต้องแสดง badge อีเมลล้มเหลวจาก `notifyError` (FE-E2.4)
- Wave E2: `requireSuperAdmin` gate routes อื่น (packages, settings) — ดู BE-E2.9

## Checklist งานต่อไป (Next Steps)
- [x] payments + dashboard (M4 code)
- [x] Wave E: admin user DELETE + payment notify fields
- [ ] FE: payment notify badge
