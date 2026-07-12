# Backend — Birth profile API (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ปิด M2** — `GET/PUT /api/me/birth-profile` แปลง พ.ศ.→ค.ศ. เก็บ UTC บังคับ `editCount ≤ 1` + unit tests

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/lib/date.ts` — `toGregorianYear()`, `buildBirthDateUtc()`
- `src/lib/schemas.ts` — `birthProfileSchema`
- `src/server/user/birth-profile-service.ts` — `canEditBirthProfile()`, `getEditsRemaining()`
- `src/app/api/me/birth-profile/route.ts` — GET/PUT + `editsRemaining`
- `tests/date.test.ts`, `tests/birth-profile-rules.test.ts`
- Geo: ดู [backend_geo_api.md](./backend_geo_api.md) (`GET /api/geo/thailand`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ต้องรู้ว่าปีเป็น พ.ศ. หรือ ค.ศ.
  - [วิธีที่ลองแก้]: รับ `yearEra` ชัดเจน; heuristic ปี ≥ 2200 = พ.ศ.

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- อำเภอ/เขตครบ 77 จังหวัด (928 รายการ) ใน `src/data/thailand-geo.ts` — อัปเดตด้วย `scripts/generate-thailand-geo.mjs`
- FE ยัง import จาก `th-geo.ts` (shim) แทน fetch API

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/birth-profile` → merge แล้ว
- [x] FE ส่ง payload ตาม schema ใหม่
- [x] API `/api/geo/thailand` + data layer
- [x] unit test: `toGregorianYear`, `editCount` enforcement
