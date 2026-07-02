# Backend — Birth profile API (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- `GET/PUT /api/me/birth-profile` ใช้งานได้ แปลงปี พ.ศ.→ค.ศ. เก็บ UTC และบังคับแก้วันเกิดได้อีกครั้งเดียว (editCount ≤ 1)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/lib/date.ts` — `toGregorianYear()`, `buildBirthDateUtc()` (รับ พ.ศ./ค.ศ., แปลงเวลาไทย UTC+7 → UTC)
- `src/lib/schemas.ts` — `birthProfileSchema` แบบมีโครงสร้าง (year/month/day + yearEra, hour/minute, จังหวัด/อำเภอบังคับ) *(central contract — คุยกับ FE ก่อนแก้)*
- `src/lib/errors.ts` — เพิ่มโค้ด `EDIT_LIMIT_REACHED` (HTTP 409)
- `src/server/user/birth-profile-service.ts` — `getBirthProfile`, `upsertBirthProfile` (บังคับ editCount, ประกอบ `birthLocation` ให้ prompt-builder เดิมใช้ต่อได้)
- `src/app/api/me/birth-profile/route.ts` — GET (profile + editsRemaining) / PUT (upsert)
- ผ่าน typecheck + lint

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ต้องรู้ว่าปีที่ส่งมาเป็น พ.ศ. หรือ ค.ศ.
  - [วิธีที่ลองแก้]: รับ `yearEra` แบบชัดเจน ถ้าไม่ส่งมาใช้ heuristic (ปี ≥ 2200 = พ.ศ.)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `birthProvince`/`birthDistrict` เป็น string อิสระ ยังไม่ผูกกับ dataset จังหวัด/อำเภอ (รอ PM ยืนยันแหล่งข้อมูล) — จะเพิ่ม validation/endpoint ภายหลัง
- FE onboarding เดิมเป็น stub ต้องปรับให้ส่ง payload ตาม schema ใหม่

## Checklist งานต่อไป (Next Steps)
- [ ] เปิด PR `be/birth-profile` (stacked บน `be/chat-model`) → PM รีวิว
- [ ] จัดเตรียม dataset จังหวัด/อำเภอ + endpoint/JSON (คุยกับ FE)
- [ ] เพิ่ม unit test: แปลงปี พ.ศ.→ค.ศ. + บังคับ editCount ≤ 1
