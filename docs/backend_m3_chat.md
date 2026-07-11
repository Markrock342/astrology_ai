# Backend — M3 Chat conversations API

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M3 BN ปิดครบ** — conversations API ใช้ `Conversation`/`Message` เป็นหลักทั้ง list, detail, multi-turn, และ readings bridge
- ✅ multi-turn context ใน prompt + adapter
- ✅ tests ครอบ thread-service, message-service, reading flow

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `thread-service.ts` — `listConversationThreads`, `getThreadDetail` จาก `Conversation`/`Message` (+ legacy `HoroscopeReading` fallback)
- `appendExchangeToConversation`, `loadPriorMessages` — ใช้ร่วมกันระหว่าง `message-service` และ `readings` route
- `POST /api/horoscope/readings` — รับ `conversationId` optional เพื่อต่อเธรด + persist messages
- `message-service` — delegate persist ไป `thread-service`
- `tests/thread-service.test.ts` — list, detail, append, legacy fallback

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: `GET /api/conversations/:id` อ่านจาก `HoroscopeReading` ไม่ตรงกับ messages ที่ persist
  - [วิธีที่ลองแก้]: `getThreadDetail` อ่าน `Message[]` จาก conversation; fallback reading สำหรับข้อมูลเก่า
- [ปัญหา]: `listUserThreads` list จาก `HoroscopeReading` ไม่ตรงกับ NATAL conversations
  - [วิธีที่ลองแก้]: `listConversationThreads(userId, "NATAL")`

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Transit engine คำนวณดวงจรอัตโนมัติ — รอ PM (gate Pro มีแล้ว)
- Refactor ลดการพึ่ง `HoroscopeReading` ต่อข้อความ — optional ภายหลัง

## Checklist งานต่อไป (Next Steps)
- [x] thread list/detail จาก Conversation/Message
- [x] readings API รองรับ `conversationId`
- [x] tests thread-service
- [ ] (M4) smoke test บน staging หลัง merge
