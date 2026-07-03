# Backend — Chat schema + Birth profile fields (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จและ merge แล้ว** (PR #1 `be/chat-model` → `main`) — schema แชท + ฟิลด์ birth profile + suggestedQuestions พร้อม migration 2 ไฟล์ (init + M2 delta)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `prisma/schema.prisma`: `Conversation` + `Message`, `ConversationMode` (NATAL/TRANSIT), `MessageRole` (USER/ASSISTANT)
- `BirthProfile`: `birthCountry`, `birthProvince`, `birthDistrict`, `editCount`
- `HoroscopeCategory.suggestedQuestions` (Json)
- `KnowledgeDoc` เพิ่มใน schema ภายหลัง (commit `8a0f4da`) — ยังไม่มี migration แยก
- `prisma/migrations/20260702000001_init` + `20260702000002_m2_chat_birthprofile_suggested`
- `prisma/seed.ts` — suggestedQuestions ต่อหมวด

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: สร้าง migration offline เพราะไม่มี Postgres ตอนพัฒนา
  - [วิธีที่ลองแก้]: `prisma migrate diff` → เขียน SQL เอง; แก้ mojibake ค่า default `'ไทย'` ด้วย UTF-8 ไม่มี BOM
- [ปัญหา]: Vercel build ไม่มี Prisma client
  - [วิธีที่ลองแก้]: `7279249` — generate client ก่อน build ใน pipeline

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `HoroscopeReading` ยังใช้งานอยู่ — ยังไม่ย้าย flow ไป `Conversation`/`Message` (งาน M3)
- `KnowledgeDoc` ใน schema อาจต้อง `db:migrate` เพิ่มถ้า DB เก่ายังไม่มีตาราง
- `GET /api/horoscope/categories` ยังไม่ส่ง `suggestedQuestions` (M3)

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/chat-model` → merge แล้ว
- [ ] รัน `npm run db:migrate` + `db:seed` บน DB จริง (Supabase) หลัง deploy
- [ ] เขียน migration สำหรับ `knowledge_docs` ถ้ายังไม่มีในฐานข้อมูล
- [ ] message-service + API `/api/conversations/*` (M3)
