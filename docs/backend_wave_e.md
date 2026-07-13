# Backend — Wave E Handoff (BE-E0.3 … BE-E1.6)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **merge เข้า `main` แล้ว** (รวม quota reservation + migrations บน Supabase)
- Branch อ้างอิงเดิม: `be/wave-e-handoff` — ไม่ต้อง merge ซ้ำ

## งานที่เพิ่งทำเสร็จ (Recently Completed)

### Quota reservation (production hardening)
- `UsageStatus.RESERVED` — จองโควต้าก่อนเรียก AI ภายใต้ `FOR UPDATE` lock
- `reserveUsageSlot` / `releaseUsageReservation` — นับ SUCCESS+RESERVED ป้องกัน concurrent over-quota
- Composite index `(userId, status, createdAt)` บน `ai_usage_logs`
- Stale RESERVED cleanup (TTL 5 นาที) ก่อนจองใหม่
- `GET /api/me/usage` นับเฉพาะ SUCCESS (ไม่รวม in-flight)

### BE-E0.3 — Payment notify persistence
- `Payment.notifiedAt` / `notifyError` + migrate
- Admin list ส่ง field ใหม่

### BE-E1.2 — Quota atomic
- `reserveUsageSlot` ก่อน AI + finalize RESERVED→SUCCESS ใน charge transaction

### BE-E1.5 — QUOTA_EXCEEDED
- แยกจาก `RATE_LIMITED` (HTTP 403)

### BE-E1.3 — GET /api/me/usage
- `usage-service.ts` + `?view=summary` สำหรับ chat bar
- Contract: balance, limits, usedToday/usedThisMonth, paginated credit history

### BE-E1.4 — Credit top-up
- `Package.creditOnly` + `CREDIT_TOPUP`
- `Payment.packageCode` ตอน submit

### BE-E1.6 — PDPA account deletion
- `DELETE /api/me/account` · `DELETE /api/admin/users/[id]`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Ops: Resend / Upstash ยังเป็นงาน PM
- Wave E2 (packageId FK, cron, cost tracking) — ดู `BE_ASSIGN.md` § E2
- FE บางจุดยังค้าง: REJECTED `reviewNote` (FE-E1.2), admin notify badge เต็มรูปแบบ

## Checklist งานต่อไป (Next Steps)
- [x] Merge `be/wave-e-handoff` → `main`
- [ ] รัน `npm run db:seed` บน prod ถ้ายังไม่มี `CREDIT_TOPUP`
- [ ] ปิด FE-E1.2 / FE-E2.4 ที่ยังค้าง

## API contract สำหรับ FE

### GET /api/me/usage?cursor=&view=summary
`view=summary` — ไม่ดึง credit history 20 แถว (ใช้ใน chat bar)

### POST /api/payments/manual
optional `packageCode` (`PRO` | `CREDIT_TOPUP`)

### Error code
`QUOTA_EXCEEDED` — โควต้ารายวัน/เดือนหมด (ไม่ใช่ rate-limit)
