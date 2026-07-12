# Backend — User API (/api/me) (M2+)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ครบ** — `GET /api/me` (รวม `canChat`), package, credits, **usage**, birth-profile, natal-chart, profile, password, avatar, subscription cancel, **account delete (PDPA)**

## งานที่เพิ่งทำเสร็จ (Recently Completed) — Wave E
- `GET /api/me/usage` — balance, daily/monthly limits, usedToday/usedThisMonth, paginated `CreditTransaction` history (`usage-service.ts`)
- `DELETE /api/me/account` — self-serve deletion สำหรับ role `USER` (`account-deletion-service.ts`)
- Error code ใหม่จาก quota: `QUOTA_EXCEEDED` (แยกจาก `RATE_LIMITED`)

## งานที่เสร็จก่อนหน้า
- `src/server/user/account-service.ts` — `getEffectivePlan`, `getMe`, `getMyPackage`, `canChat`
- `src/server/horoscope/natal-chart-service.ts` — `GET /api/me/natal-chart`
- `PUT /api/me/profile`, `PUT /api/me/password`, `PUT /api/me/avatar`
- `POST /api/me/subscription/cancel`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- FE ยังต้องต่อ UI กับ `GET /api/me/usage` (FE-E1.1) และจัดการ `QUOTA_EXCEEDED` (FE-E1.4)
- `getEffectivePlan` ถูกเรียกจากหลาย service — แหล่งเดียวคือ `account-service`

## Checklist งานต่อไป (Next Steps)
- [x] `canChat` ใน `GET /api/me`
- [x] natal-chart + profile/password/avatar + subscription cancel
- [x] Wave E: `GET /api/me/usage` + `DELETE /api/me/account`
- [ ] FE: แสดง usage progress + ปุ่มลบบัญชี

## API contract — GET /api/me/usage

Query: `?cursor=<txn_id>` (optional)

```json
{
  "balance": 12,
  "dailyLimit": 20,
  "monthlyLimit": null,
  "usedToday": 3,
  "usedThisMonth": 41,
  "history": {
    "items": [
      {
        "id": "txn_…",
        "amount": -1,
        "type": "AI_USAGE",
        "note": null,
        "referenceType": "reading",
        "referenceId": "…",
        "createdAt": "2026-07-12T…"
      }
    ],
    "nextCursor": "txn_…" 
  }
}
```
