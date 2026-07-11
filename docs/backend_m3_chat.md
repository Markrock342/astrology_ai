# Backend — M3 Chat conversations API

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **API ครบบน main** — สร้าง/ดึงเธรด + ส่งข้อความ + sync `Message` ลง DB
- ✅ **B1 multi-turn** (branch `be/m3-multi-turn-chat`) — โหลดประวัติเธรด → ส่งเข้า Gemini/OpenAI หลาย turn + trim context
- ✅ **B2 tests** (branch `be/m3-tests`) — credit, refund path, locks, idempotency, rbac, router fallback

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `buildConversationHistory()` + `trimConversationHistory()` ใน `prompt-builder.ts`
- `reading-service.ts` รับ `priorMessages` → ส่ง `conversationHistory` เข้า adapter
- `providers/gemini.ts` + `openai.ts` — รองรับ `contents[]` / `messages[]` หลาย turn
- `message-service.ts` — โหลด prior messages, idempotency ที่ `Message` ก่อนสร้างซ้ำ
- `tests/prompt-builder.test.ts` — unit test thread history + trim
- `tests/reading-service.test.ts`, `message-service.test.ts`, `credit-service.test.ts`, `quota-service.test.ts`, `rbac.test.ts`, `router-fallback.test.ts` — B2 coverage

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ผู้ใช้ถามต่อเนื่อง AI ตอบเหมือนเริ่มใหม่
  - [วิธีที่ลองแก้]: ส่งประวัติเธรดเข้า prompt; turn แรก enrich ด้วย birth profile + chart
- [ปัญหา]: retry idempotency-key สร้าง Message ซ้ำ
  - [วิธีที่ลองแก้]: เช็ค `Message` (conversationId + idempotencyKey) ก่อนเรียก AI

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- FN F2: render ประวัติเธรดเต็มจาก API (หลัง merge B1)

## Checklist งานต่อไป (Next Steps)
- [x] B1: โหลด `Message[]` → ส่งเข้า prompt + adapter multi-turn
- [x] B1: idempotency ไม่สร้าง message ซ้ำ
- [x] B2: tests chat + idempotency + Pro lock + credit/refund + admin auth
- [ ] FN F2: FE แสดง thread history
