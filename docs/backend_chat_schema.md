# Backend — Chat schema + Birth profile fields (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ปรับ Prisma schema เป็นโมเดลแชท (Conversation + Message) เพิ่มฟิลด์ birth profile และ suggestedQuestions เสร็จแล้ว พร้อม migration แบบ offline (init + delta) — รอรันกับ DB จริงด้วย `npm run db:migrate`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `prisma/schema.prisma`:
  - เพิ่ม enum `ConversationMode` (NATAL/TRANSIT), `MessageRole` (USER/ASSISTANT)
  - เพิ่มโมเดล `Conversation` (userId, categoryId, mode, title) + `Message` (role, content, idempotencyKey, provider/modelId/promptVersion/creditCost/inputUsage/outputUsage) — หักเครดิต "ต่อข้อความ AI"
  - `BirthProfile`: เพิ่ม `birthCountry` (default "ไทย"), `birthProvince`, `birthDistrict`, `editCount` (default 0)
  - `HoroscopeCategory`: เพิ่ม `suggestedQuestions Json?`
- `prisma/migrations/20260702000001_init` — baseline (โปรเจกต์เดิมไม่เคยมี migration)
- `prisma/migrations/20260702000002_m2_chat_birthprofile_suggested` — delta ของ M2
- `prisma/seed.ts` — เพิ่ม suggestedQuestions ต่อหมวด
- ผ่าน `prisma validate` + `db:generate` + `typecheck` + `lint`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ไม่มี DB/`.env` → รัน `prisma migrate dev` ไม่ได้
  - [วิธีที่ลองแก้]: สร้าง migration แบบ offline ด้วย `prisma migrate diff --from-empty` (init) และ `--from-schema-datamodel ... --to-schema-datamodel` (delta) แล้วเขียนไฟล์ SQL เอง
- [ปัญหา]: ค่า default ภาษาไทย `'ไทย'` เพี้ยนเป็น mojibake เมื่อ pipe ผ่าน PowerShell `Out-File`
  - [วิธีที่ลองแก้]: เขียนไฟล์ migration.sql ใหม่ด้วย UTF-8 และลบ BOM แบบ byte-level

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- migration ยังไม่ได้รันกับ Postgres จริง (สภาพแวดล้อมนี้ไม่มี DB) — ต้อง `npm run db:migrate` ยืนยันก่อน merge
- `birthProvince`/`birthDistrict` เป็น nullable ที่ DB (ปลอดภัยต่อ migration) แต่จะ "บังคับ" ที่ service/Zod ใน PR ถัดไป
- ยังไม่แตะ `HoroscopeReading`/`AIUsageLog` (การแปลง reading→message เป็นงาน M3)

## Checklist งานต่อไป (Next Steps)
- [ ] เปิด PR `be/chat-model` → PM รีวิว
- [ ] รัน `npm run db:migrate` กับ DB จริงเพื่อยืนยัน migration
- [ ] birth-profile service + API (พ.ศ.→ค.ศ., editCount≤1) — PR `be/birth-profile`
- [ ] เสิร์ฟ suggestedQuestions ใน `GET /api/horoscope/categories` (M3)
