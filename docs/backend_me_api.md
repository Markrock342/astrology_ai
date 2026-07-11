# Backend — User API (/api/me) (M2+)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ครบ** — `GET /api/me` (รวม `canChat`), package, credits, birth-profile, natal-chart, profile, password, avatar, subscription cancel

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/user/account-service.ts` — `getEffectivePlan`, `getMe`, `getMyPackage`, `canChat`
- `src/server/horoscope/natal-chart-service.ts` — `GET /api/me/natal-chart`
- `PUT /api/me/profile`, `PUT /api/me/password`, `PUT /api/me/avatar`
- `POST /api/me/subscription/cancel`
- FE: `account-view.tsx`, `settings-modals.tsx`, `profile-avatar-card.tsx`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `getEffectivePlan` ถูกเรียกจากหลาย service — แหล่งเดียวคือ `account-service` แล้ว (horoscope เรียก import)

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/me-api` → merge แล้ว
- [x] `canChat` ใน `GET /api/me`
- [x] natal-chart + profile/password/avatar + subscription cancel
