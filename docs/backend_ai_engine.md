# Backend — AI engine + readings (M3 บางส่วน)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- 🚧 **ทำงานได้บางส่วน** — Gemini (+ OpenAI) adapter จริง, `POST /api/horoscope/readings` หักเครดิตหลังสำเร็จ; ยังใช้โมเดล `HoroscopeReading` ไม่ใช่ `Conversation`/`Message`
- เปิดใช้เมื่อ `FEATURES.aiChat` = true; ปิดบน Vercel ถ้า `NEXT_PUBLIC_APP_PHASE=2`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/ai/providers/gemini.ts` — REST adapter จริง, `AbortController`, ไม่ throw (คืน `ok:false`)
- `src/server/ai/providers/openai.ts` — adapter สำรอง
- `src/server/ai/router.ts` — fallback chain ตาม config
- `src/server/horoscope/reading-service.ts` — charge-after-success + idempotency (ยังระดับ reading)
- `POST /api/horoscope/readings` — gated ด้วย `FEATURES.aiChat`
- FE `chat-view.tsx` เรียก readings API + typewriter UI (`6de3053`, `0250fd7`)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ต้องแยก milestone บน Vercel demo
  - [วิธีที่ลองแก้]: `features.ts` — phase 2 ปิด AI chat; dev ไม่ตั้ง phase = เปิดหมด

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ยังไม่มี `/api/conversations/*` — แชท FE ยังไม่ persist เธรดลง DB (reset เมื่อเปลี่ยนหมวด)
- `reading-service` ยังไม่ส่งประวัติสนทนาใน prompt (M3 checklist)
- `GET /api/horoscope/categories` ยังไม่คืน `suggestedQuestions`
- ดวงจร (TRANSIT) ยังไม่ gate ที่ service
- ยังไม่มี tests: credit, refund, idempotency, Free/Pro lock

## Checklist งานต่อไป (Next Steps)
- [ ] refactor → `message-service` + ใช้ `Conversation`/`Message`
- [ ] API แชท: POST/GET conversations + messages
- [ ] prompt-builder: thread context + natal/transit mode
- [ ] `suggestedQuestions` ใน categories API
- [ ] tests ตาม BACKEND_TASKS M3
