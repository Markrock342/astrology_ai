# Backend — Admin API (users, categories, packages) (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- Admin API ครบสำหรับ M2: จัดการผู้ใช้ (list/detail/status/credits/subscription) + CRUD หมวดหมู่ + CRUD แพ็กเกจ ทุก mutation ผ่าน `requireAdmin()` และบันทึก `writeAudit()`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/lib/admin-schemas.ts` — Zod สำหรับทุก endpoint (list query, user status/credits/subscription, category/package create/update)
- `src/server/admin/user-admin-service.ts` — `listUsers`, `getUserDetail`, `setUserStatus`, `adjustUserCredits` (ผ่าน ledger), `setUserSubscription`
- `src/server/admin/catalog-admin-service.ts` — CRUD categories + packages (ลบไม่ได้ถ้ายังถูกอ้างอิง → ให้ปิดการใช้งานแทน)
- Routes:
  - `GET /api/admin/users`, `GET /api/admin/users/:id`
  - `PATCH /api/admin/users/:id/status`, `POST /api/admin/users/:id/credits`, `PATCH /api/admin/users/:id/subscription`
  - `GET|POST /api/admin/categories`, `GET|PATCH|DELETE /api/admin/categories/:id`
  - `GET|POST /api/admin/packages`, `GET|PATCH|DELETE /api/admin/packages/:id`
- ทุก mutation อยู่ใน DB transaction เดียวกับ `writeAudit` (before/after + adminUserId + ip)
- ผ่าน typecheck + lint

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Prisma typing ของ Json (`suggestedQuestions`) และ scalar FK ใน create/update
  - [วิธีที่ลองแก้]: รับ input แบบ explicit type ใน service แล้ว cast เป็น `Unchecked*Input` ของ Prisma

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `setUserSubscription` ยังไม่เติมเครดิตอัตโนมัติเมื่อเปลี่ยนเป็น Pro (การเติมเครดิต/ชำระเงินเป็นงาน M4)
- ยังไม่มี admin CRUD สำหรับ prompts/ai-configs (อยู่ M3) และ payments/dashboard (M4)
- dynamic route ใช้รูปแบบ Next 16 (`params: Promise<...>` + `await`)

## Checklist งานต่อไป (Next Steps)
- [ ] เปิด PR `be/admin-api` (stacked) → PM รีวิว
- [ ] เพิ่ม test: admin auth guard + audit ถูกเขียนทุก mutation + credit adjust ผ่าน ledger
- [ ] (M3) CRUD prompts/ai-configs · (M4) payments review + dashboard
