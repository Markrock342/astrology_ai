# Backend — AI engine + readings (M3)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Gemini/OpenAI adapter จริง** — charge-after-success + idempotency ใน `reading-service.ts`
- ✅ `POST /api/horoscope/readings` และ flow แชทผ่าน `message-service` (delegate ไป readings)
- 🟡 **B1 ค้าง:** prompt ยังไม่รับประวัติเธรดหลาย turn — ดู [backend_m3_chat.md](./backend_m3_chat.md)
- เปิดใช้เมื่อ `FEATURES.aiChat` = true; ปิดบน Vercel ถ้า `NEXT_PUBLIC_APP_PHASE=2`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/ai/providers/gemini.ts` — REST adapter จริง, `AbortController`, คืน `ok:false` (ไม่ throw)
- `src/server/ai/providers/openai.ts` — adapter สำรอง + `router.ts` fallback chain
- `src/server/horoscope/reading-service.ts` — 4 กฎ: permission+quota ก่อน AI · fail ไม่หักเครดิต · idempotency · charge+persist ใน transaction
- `src/server/horoscope/category-service.ts` — คืน `suggestedQuestions` ใน `GET /api/horoscope/categories`
- `src/server/horoscope/engine/newhora/*` — chart engine port เต็ม + `natal-chart-service.ts`
- `tests/chart-engine.test.ts`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ต้องแยก milestone บน Vercel demo
  - [วิธีที่ลองแก้]: `features.ts` — phase 2 ปิด AI chat; dev ไม่ตั้ง phase = เปิดหมด

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `message-service.sendMessage()` ยังเรียก `createReading()` โดยไม่ส่งประวัติข้อความก่อนหน้า (B1)
- `HoroscopeReading` ยังเป็นฐานของ pipeline — sync ไป `Message` แต่ยังไม่ refactor เต็มรูป
- ยังไม่มี tests: credit, refund, idempotency, Free/Pro lock, admin auth (B2)
- Transit mode: gate `TRANSIT_REQUIRES_PRO` มีแล้ว แต่ยังไม่มี engine คำนวณดวงจรอัตโนมัติ

## Checklist งานต่อไป (Next Steps)
- [ ] B1: `prompt-builder` รับ thread history + natal/transit context
- [ ] B1: `message-service` ไม่ delegate แบบคำถามเดี่ยว
- [ ] B2: tests ตาม `BACKEND_TASKS.md` M3
