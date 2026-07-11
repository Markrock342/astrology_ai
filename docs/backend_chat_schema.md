# Backend — Chat schema + Birth profile fields (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **เสร็จและ merge แล้ว** — schema แชท + ฟิลด์ birth profile + suggestedQuestions พร้อม migrations หลายรอบบน Supabase

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `prisma/schema.prisma`: `Conversation` + `Message`, `ConversationMode` (NATAL/TRANSIT), `MessageRole` (USER/ASSISTANT)
- `BirthProfile`: `birthCountry`, `birthProvince`, `birthDistrict`, `editCount`
- `HoroscopeCategory.suggestedQuestions` (Json)
- `KnowledgeDoc`, `PasswordResetToken`, CMS revisions/settings models (migrations ภายหลัง M2)
- `prisma/migrations/` — init, M2 delta, knowledge_docs, password_reset_token, CMS ฯลฯ
- `prisma/seed.ts` — suggestedQuestions ต่อหมวด

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: สร้าง migration offline เพราะไม่มี Postgres ตอนพัฒนา
  - [วิธีที่ลองแก้]: `prisma migrate diff` → เขียน SQL เอง; แก้ mojibake ค่า default `'ไทย'` ด้วย UTF-8 ไม่มี BOM
- [ปัญหา]: Vercel build ไม่มี Prisma client
  - [วิธีที่ลองแก้]: generate client ก่อน build ใน pipeline

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `HoroscopeReading` ยังใช้งานใน reading pipeline — API แชท sync `Message` แต่ logic หลักยังผ่าน readings (B1)
- `GET /api/horoscope/categories` ส่ง `suggestedQuestions` แล้ว (ผ่าน `category-service.ts`)

## Checklist งานต่อไป (Next Steps)
- [x] เปิด PR `be/chat-model` → merge แล้ว
- [x] migrate + seed บน Supabase (dev/staging)
- [x] migration `knowledge_docs`, `password_reset_token`
- [ ] B1: ย้าย flow หลักจาก `HoroscopeReading` → `Message` เต็มรูป (optional หลัง multi-turn)
