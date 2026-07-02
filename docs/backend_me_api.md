# Backend — User API (/api/me) (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- `GET /api/me`, `GET /api/me/package`, `GET /api/me/credits` ใช้งานได้ครบ โดย business logic ย้ายไป service layer แล้ว

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/user/account-service.ts` — `getEffectivePlan`, `getMe` (profile + plan + creditBalance + birthEditsRemaining), `getMyPackage` (subscription + package + balance)
- `src/app/api/me/route.ts` — refactor ให้เรียก `getMe()` (route บางลง)
- `src/app/api/me/package/route.ts` — เพิ่มใหม่
- `/api/me/credits` มีอยู่แล้วจาก M1 (คงไว้)
- ผ่าน typecheck + lint

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `reading-service.ts` ยังมี `getEffectivePlan` เป็น private ของตัวเอง (ซ้ำกับ account-service) — รวมเป็นตัวเดียวตอน refactor เป็น message-service ใน M3

## Checklist งานต่อไป (Next Steps)
- [ ] เปิด PR `be/me-api` (stacked) → PM รีวิว
- [ ] รวม `getEffectivePlan` ให้เหลือแหล่งเดียว (M3)
