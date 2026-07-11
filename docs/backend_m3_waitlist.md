# Backend — M3 รายการรอ/ค้าง (Waitlist)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M3 BN โค้ด + unit tests ครบ 100%** บน branch `be/m3-thread-service` (รวม B1 multi-turn, B2 tests, thread list/detail)
- ⏳ **ยังไม่อยู่บน `main`** — รอ merge 3 branch ก่อน smoke test จริง

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- ดู [backend_m3_chat.md](./backend_m3_chat.md) — สรุปงาน M3 chat ทั้งหมด

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีบันทึกใหม่

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)

### รอ PM / ทีม (ไม่ใช่งานโค้ด BN ต่อได้เอง)

| รายการ | รอใคร | เหตุผล |
|--------|-------|--------|
| Merge `be/m3-multi-turn-chat` → `be/m3-tests` → `be/m3-thread-service` เข้า `main` | PM / คุณ | กติกา repo — ห้าม push ตรง main |
| **Transit engine** คำนวณดวงจรอัตโนมัติ | PM | ยืนยัน scope Phase 1 หรือเลื่อน — gate `TRANSIT_REQUIRES_PRO` มีแล้ว |
| Quota/ราคา/Pro หมดอายุรายเดือน | PM | ค่า default ใน seed/constants ยังไม่ final |

### หลัง merge เข้า main (ทำได้โดยไม่รอ PM แต่รอ merge ก่อน)

| รายการ | หมายเหตุ |
|--------|----------|
| **Smoke test** แชท multi-turn 3–4 ข้อความบน staging | ยืนยัน AI จำบทก่อนหน้า + หักเครดิตถูก |
| ตรวจ `GET /api/conversations/:id` โหลดเธรดเต็มจาก DB จริง | หลังมี conversation ใน staging |

### Optional / ไม่บล็อกปิด M3

| รายการ | หมายเหตุ |
|--------|----------|
| Integration test ต่อ PostgreSQL จริง | B2 เป็น unit+mock ครบแล้ว |
| Test ทุก `/api/admin/*` route แยกไฟล์ | `rbac.test.ts` ครอบ `requireAdmin` แล้ว |
| Refactor ลด `HoroscopeReading` ต่อข้อความ | ทำภายหลังได้ |

## Checklist งานต่อไป (Next Steps)
- [ ] Merge M3 branches → `main`
- [ ] Smoke test หลัง merge (BN)
- [ ] เริ่ม M4: B3 (รอ PM rate-limit) + B4 (go-live)
