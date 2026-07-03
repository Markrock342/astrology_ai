# Backend — Thailand geo API (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จบน `be/m2-close`** — dataset อยู่ที่ `src/data/thailand-geo.ts` และเสิร์ฟผ่าน `GET /api/geo/thailand`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/data/thailand-geo.ts` — จังหวัด 77 จังหวัด + อำเภอชุดย่อ (กทม. ครบ 50 เขต)
- `src/server/geo/thailand-geo-service.ts` — `getThailandGeo()`, `getDistrictsForProvince()`
- `src/app/api/geo/thailand/route.ts` — public GET ไม่ต้อง auth
- `src/lib/th-geo.ts` — re-export จาก data layer (FE import เดิมยังใช้ได้)
- `tests/` — ไม่ครอบคลุม geo (static data)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: FE เคย import จาก `th-geo.ts` โดยตรง
  - [วิธีที่ลองแก้]: คง re-export shim ไว้ ไม่บังคับ FE เปลี่ยนทันที

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- อำเภอยังไม่ครบทุกจังหวัด — รอ PM ยืนยันแหล่งข้อมูลเต็ม
- FE ยัง import static; สามารถเปลี่ยนเป็น fetch `/api/geo/thailand` ในงาน FE แยก

## Checklist งานต่อไป (Next Steps)
- [ ] ขยาย `DISTRICTS` เมื่อได้ dataset เต็มจาก PM
- [ ] (FE) โหลด geo จาก API แทน static import (optional)
