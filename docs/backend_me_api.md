# Backend — User API (/api/me) (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จและ merge แล้ว** (PR #4) — `GET /api/me`, `GET /api/me/package`, `GET /api/me/credits` ครบ; logic อยู่ใน service layer

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/user/account-service.ts` — `getEffectivePlan`, `getMe`, `getMyPackage`
- `src/app/api/me/route.ts`, `package/route.ts`, `credits/route.ts`
- FE `account-view.tsx` แสดงแพ็กเกจ/เครดิต (`0250fd7`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `getEffectivePlan` ซ้ำใน `reading-service.ts` — รวมแหล่งเดียวตอน message-service (M3)

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/me-api` → merge แล้ว
- [ ] รวม `getEffectivePlan` ให้ export จาก `account-service` แล้วให้ horoscope เรียกใช้ (M3)
