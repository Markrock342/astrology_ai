# Backend — Admin API users / categories / packages (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จและ merge แล้ว** (PR #5) — users (list/detail/status/credits/subscription) + CRUD categories/packages; ทุก mutation `requireAdmin()` + `writeAudit()`
- ✅ เพิ่มภายหลัง: `GET /api/packages` (public), admin แก้ราคาแพ็กเกจจาก CMS (`f74fde5`), FE managers (`packages-manager.tsx` ฯลฯ)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/lib/admin-schemas.ts` — Zod สำหรับ admin endpoints
- `src/server/admin/user-admin-service.ts` — users CRUD + credits (ledger) + subscription
- `src/server/admin/catalog-admin-service.ts` — categories/packages CRUD + `listPublicPackages()`
- Routes ภายใต้ `src/app/api/admin/users/*`, `categories/*`, `packages/*`
- FE: `packages-manager.tsx`, `admin/ui.tsx`, redirect `/admin` → dashboard (`956b893`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Prisma Json typing ใน category create/update
  - [วิธีที่ลองแก้]: explicit input types + `Unchecked*Input` cast

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `setUserSubscription` ยังไม่เติมเครดิตอัตโนมัติเมื่อเปลี่ยน Pro (M4/payment)
- ยังไม่มี `GET /api/admin/dashboard`, payment review (M4)
- ยังไม่มี automated test admin auth / audit

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/admin-api` → merge แล้ว
- [ ] test: `requireAdmin` + `writeAudit` ทุก mutation
- [ ] (M4) payments + dashboard
