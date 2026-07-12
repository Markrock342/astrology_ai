# Backend — Thailand geo API (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จบน `main`** — dataset อยู่ที่ `src/data/thailand-geo.ts` (77 จังหวัด + 928 อำเภอ/เขต) และเสิร์ฟผ่าน `GET /api/geo/thailand`
- สร้าง/อัปเดตด้วย `node scripts/generate-thailand-geo.mjs` จาก [thailand-geography-json](https://github.com/thailand-geography-data/thailand-geography-json)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/data/thailand-geo.ts` — จังหวัด 77 จังหวัด + อำเภอ/เขต 928 รายการ (ครบทุกจังหวัด)
- `src/server/geo/thailand-geo-service.ts` — `getThailandGeo()`, `getDistrictsForProvince()`
- `src/app/api/geo/thailand/route.ts` — public GET ไม่ต้อง auth
- `src/lib/th-geo.ts` — re-export จาก data layer (FE import เดิมยังใช้ได้)
- `tests/` — ไม่ครอบคลุม geo (static data)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: FE เคย import จาก `th-geo.ts` โดยตรง
  - [วิธีที่ลองแก้]: คง re-export shim ไว้ ไม่บังคับ FE เปลี่ยนทันที

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- FE ยัง import static; สามารถเปลี่ยนเป็น fetch `/api/geo/thailand` ในงาน FE แยก (optional)
