# HoraSard — Master Index / Architecture Map

สารบัญกลางของโปรเจกต์ + แผนที่สถาปัตยกรรม (อัปเดตทุกครั้งที่มีงานใหม่)

## ภาพรวมสถาปัตยกรรม

- **UI (`src/app`, `src/components`)** — thin, ไม่มี business logic เรียก service ผ่าน API เท่านั้น
- **Service layer (`src/server/*`)** — business logic ทั้งหมด (auth, credit, horoscope/chat, ai, audit)
- **API (`src/app/api/*`)** — route handler บางๆ: validate (Zod) + authorize (rbac) + เรียก service ผ่าน `handle()`
- **DB (`prisma/`)** — schema + migrations + seed (PostgreSQL + Prisma 6)

รายละเอียดเต็ม: `README.md` (สถาปัตยกรรม/วิธีรัน) · `BACKEND_TASKS.md` · `FRONTEND_TASKS.md`

## โมดูล / ฟีเจอร์ (Backend)

| โมดูล | สถานะ | ไฟล์บันทึก | โค้ดหลัก |
| ----- | ----- | --------- | -------- |
| Chat schema (Conversation/Message) + Birth profile fields | 🚧 M2 กำลังทำ | [backend_chat_schema.md](./backend_chat_schema.md) | `prisma/schema.prisma`, `prisma/migrations/*` |
| Birth profile API (พ.ศ.→ค.ศ., editCount≤1) | 🚧 M2 กำลังทำ | [backend_birth_profile.md](./backend_birth_profile.md) | `src/app/api/me/birth-profile`, `src/server/user/birth-profile-service.ts` |
| Google auth + auto-create user | 🚧 M2 กำลังทำ | [backend_google_auth.md](./backend_google_auth.md) | `src/server/auth/*`, `src/auth.ts` |
| User API (`/api/me`, `/api/me/package`) | 🚧 M2 กำลังทำ | [backend_me_api.md](./backend_me_api.md) | `src/app/api/me/*`, `src/server/user/account-service.ts` |
| Admin API (users, categories, packages) | ⏳ วางแผน | — | `src/app/api/admin/*` |

## Milestone ปัจจุบัน

**M2** — Schema chat, Auth (Google), Birth profile, Admin API
(ดู checklist เต็มใน `BACKEND_TASKS.md` §2)

## รอ PM ยืนยัน (blocking บางส่วน)

- ดวงจร (transit) อยู่ Phase 1 ไหม → ตอนนี้ใส่ enum `TRANSIT` ไว้แต่ยังไม่ทำ auto-คำนวณ
- Sign-in อีเมล: magic-link หรือ อีเมล+รหัสผ่าน → ตอนนี้ใช้ Credentials (email+password) เดิม
- แหล่งข้อมูลจังหวัด/อำเภอไทย → เสนอฝัง JSON ใน repo
