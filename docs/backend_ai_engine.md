# Backend — AI engine + readings (M3)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Gemini/OpenAI adapter จริง** — charge-after-success + idempotency ใน `reading-service.ts`
- ✅ `POST /api/horoscope/readings` และ flow แชทผ่าน `message-service` (ส่งประวัติเธรด)
- ✅ Router: `resolveConfig` (category + plan + preferFast) + `generateWithFallback` สำหรับแชท; `generateOnce` สำหรับ admin health/test
- เปิดใช้เมื่อ `FEATURES.aiChat` = true; ปิดบน Vercel ถ้า `NEXT_PUBLIC_APP_PHASE=2`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Thread history: `message-service` โหลด prior messages → `createReading` / `streamReading` (B1 ปิดแล้ว)
- `generateOnce` แยกจาก fallback เพื่อไม่ให้ health หลอกเขียว
- Tie-break deterministic ใน `resolveConfig` เมื่อ score ชน
- OpenAI-compatible: Base URL จาก config; stream ยังเป็น one-shot + single delta

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ต้องแยก milestone บน Vercel demo
  - [วิธีที่ลองแก้]: `features.ts` — phase 2 ปิด AI chat; dev ไม่ตั้ง phase = เปิดหมด
- [ปัญหา]: health/test ใช้ fallback แล้วเขียวทั้งที่ primary พัง → แก้ด้วย `generateOnce`

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- OpenAI-compatible ยังไม่ true streaming
- `HoroscopeReading` ยังเป็นฐานของ pipeline บางส่วน
- Estimated cost ของโมเดลนอกตาราง pricing ใช้ fallback rate

## Checklist งานต่อไป (Next Steps)
- [x] B1: prompt-builder / message-service รับ thread history
- [x] Primary-only generate สำหรับ admin probes
- [ ] (Optional) true streaming สำหรับ OpenAI-compatible
