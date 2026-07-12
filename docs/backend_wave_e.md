# Backend — Wave E Handoff (BE-E0.3 … BE-E1.6)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **HANDOFF_BE ครบ 100%** + hardening quota reservation บน branch `be/wave-e-handoff`
- Migration `20260712140000_wave_e_handoff` + `20260712150000_quota_reservation` apply แล้วบน Supabase

## งานที่เพิ่งทำเสร็จ (Recently Completed)

### Quota reservation (production hardening)
- `UsageStatus.RESERVED` — จองโควต้าก่อนเรียก AI ภายใต้ `FOR UPDATE` lock
- `reserveUsageSlot` / `releaseUsageReservation` — นับ SUCCESS+RESERVED ป้องกัน concurrent over-quota
- Composite index `(userId, status, createdAt)` บน `ai_usage_logs`
- Stale RESERVED cleanup (TTL 5 นาที) ก่อนจองใหม่
- `GET /api/me/usage` นับเฉพาะ SUCCESS (ไม่รวม in-flight)

### BE-E0.3 — Payment notify persistence
- `Payment.notifiedAt` / `notifyError` + migrate
- `notifyUserPaymentReviewed` คืน `SendEmailResult` + `persistPaymentNotifyResult`
- Admin `GET /api/admin/payments` ส่ง field ใหม่

### BE-E1.2 — Quota atomic
- `reserveUsageSlot` ก่อน AI + finalize RESERVED→SUCCESS ใน charge transaction
- `lockWalletForUpdate` คืน balance สำหรับตรวจก่อนจอง

### BE-E1.5 — QUOTA_EXCEEDED
- แยกจาก `RATE_LIMITED` (HTTP 403) ใน `quota-service.ts`

### BE-E1.3 — GET /api/me/usage
- `src/server/account/usage-service.ts` + `src/app/api/me/usage/route.ts`
- Contract: balance, limits, usedToday/usedThisMonth, paginated credit history

### BE-E1.4 — Credit top-up
- `Package.creditOnly` + seed `CREDIT_TOPUP`
- `Payment.packageCode` ตอน submit + validate `amount === Package.price`
- `reviewPayment` branch: top-up = เติมเครดิตเท่านั้น ไม่แตะ subscription
- `GET /api/packages` ส่ง `creditOnly`

### BE-E1.6 — PDPA account deletion
- `DELETE /api/me/account` (USER เท่านั้น)
- `DELETE /api/admin/users/[id]` (SUPER_ADMIN + audit)
- ลบ slip blobs ก่อนลบ user

## Tests (90+ รวมบน branch)
- `tests/payment-notify.test.ts` · `tests/usage-service.test.ts` · `tests/account-deletion-service.test.ts`
- อัปเดต `payment-service`, `quota-service` (reserve/release), `reading-service`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Ops: Resend / Upstash ยังเป็นงาน PM (ไม่บล็อกโค้ด)
- Wave E2 (packageId FK, cron, cost tracking) — ดู `BE_ASSIGN.md` § E2

## Checklist งานต่อไป (Next Steps)
- [ ] Merge `be/wave-e-handoff` → `main`
- [ ] รัน `npm run db:seed` บน prod เพื่อสร้าง `CREDIT_TOPUP` (ถ้ายังไม่มี)
- [ ] แจ้ง FE: contract `/api/me/usage`, `QUOTA_EXCEEDED`, `creditOnly` packages, notify fields

## API contract สำหรับ FE

### GET /api/me/usage?cursor=
```json
{
  "balance": 12,
  "dailyLimit": 20,
  "monthlyLimit": null,
  "usedToday": 3,
  "usedThisMonth": 41,
  "history": { "items": [...], "nextCursor": "txn_id" | null }
}
```

### POST /api/payments/manual
เพิ่ม optional `packageCode` (`PRO` | `CREDIT_TOPUP`)

### Error code ใหม่
`QUOTA_EXCEEDED` — โควต้ารายวัน/เดือนหมด (ไม่ใช่ rate-limit HTTP)
