# HORASARD — ดูดวงด้วย AI (โหราศาสตร์ไทย)

แอปเว็บตัวเดียว: สมัคร → กรอกวันเกิด → เลือกหมวด → แชทถาม AI (Gemini)
มีแพ็กเกจ Free/Pro, เครดิต, และ Admin CMS

**เว็บที่ลูกค้าใช้:** [horasard.com](https://horasard.com/)

ขึ้น `horasard.com` = repo [`astrology_ai`](https://github.com/Markrock342/astrology_ai)

---

## อ่านตรงนี้ก่อน — โฟลเดอร์นี้คือ HORASARD ไม่ใช่ NewHora

| ชื่อ | คืออะไร |
|------|---------|
| `horasard.com` | โดเมนจริง / production ของ **โปรเจกต์นี้** |
| โฟลเดอร์ `hora_ai` บนเครื่อง | โค้ด HORASARD (ชื่อโฟลเดอร์เก่า — อย่าสับสน) |
| [github.com/Markrock342/astrology_ai](https://github.com/Markrock342/astrology_ai) | GitHub ของ **โปรเจกต์นี้** |
| `horaai.vercel.app` / `astrology-ai-three.vercel.app` | URL Vercel เก่าของ HORASARD |

**คนละเว็บ:** [hora-ai.vercel.app](https://hora-ai.vercel.app/) คือ **NewHora** (โปรโตไทป์ผูกดวง) จาก repo อีกอัน [github.com/Markrock342/hora_ai](https://github.com/Markrock342/hora_ai) — หน้า splash เขียว / โลโก้ดอก ไม่ใช่แอปนี้

โปรเจกต์นี้ยืม **สูตรคำนวณ** จาก NewHora ไว้ใน `src/server/horoscope/engine/newhora/` แต่ UI และผลิตภัณฑ์คนละตัว: HORASARD = แชทดูดวงด้วย AI

อย่าสับสนกับ **[horasad.com](https://www.horasad.com/)** (สะกดขาดตัว **r**) — โปรแกรมโหราศาสตร์คนละเจ้า

```
เครื่อง:   /…/hora_ai          ← HORASARD
GitHub:   Markrock342/astrology_ai
เว็บจริง:  horasard.com

คนละ repo: Markrock342/hora_ai  →  hora-ai.vercel.app  (NewHora)
```

รายละเอียดสถานะ/โมดูล: [`docs/index.md`](./docs/index.md) · โครงสร้างโฟลเดอร์: [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| DB / ORM | PostgreSQL + Prisma 6 |
| Auth | Auth.js (NextAuth v5) — อีเมล + Google |
| AI | Gemini ผ่าน adapter/router ฝั่ง server เท่านั้น |
| Validation | Zod |

---

## รันบนเครื่อง

```bash
npm install
cp .env.example .env
# ตั้ง DATABASE_URL, AUTH_SECRET (`npx auth secret`), SEED_ADMIN_PASSWORD

npm run db:migrate
npm run db:seed
npm run dev                 # http://localhost:3000
```

แอดมินเริ่มต้น: `SEED_ADMIN_EMAIL` (ดีฟอลต์ `admin@horasard.local`) — ตั้งรหัสใน `.env` ห้าม commit ค่ารหัสจริง

| Script | ทำอะไร |
|--------|--------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run ci` | typecheck + lint + unit (เกตเดียวกับ Vercel) |
| `npm run typecheck` / `lint` / `test` | แยกทีละอย่าง |
| `npm run db:migrate` / `db:seed` / `db:studio` | Prisma |
| `npm run hooks:install` | pre-push รัน `npm run ci` |

Vercel รัน `vercel-build` (`npm run ci` แล้วค่อย `next build`) ทุกครั้งที่ push — typecheck/lint/unit พังแล้วจะไม่ขึ้น production

---

## กฎเหล็ก

- **UI ไม่มี business logic** — หน้าเว็บเรียก `src/server/*` ผ่าน API เท่านั้น
- **ห้ามเรียก Gemini/OpenAI จาก browser**
- **ห้ามเก็บ API key เป็น plain text ใน DB** — ใช้ AES-GCM (`encryptedApiKey`) ดู [`docs/backend_ai_admin.md`](./docs/backend_ai_admin.md)
- **หักเครดิตหลัง AI สำเร็จเท่านั้น** และต้องมี `Idempotency-Key`

```
src/app/        หน้าเว็บ + API routes (บาง — เรียก service)
src/server/     business logic (ห้ามมี React)
src/components/ UI
prisma/         schema + migrations + seed
```

งาน FE: [`FRONTEND_TASKS.md`](./FRONTEND_TASKS.md) · งาน BE: [`BACKEND_TASKS.md`](./BACKEND_TASKS.md)

---

## หมายเหตุ

- Prisma ล็อกไว้ที่ v6 โดยตั้งใจ
- โซน `(app)` / `(admin)` กันที่ layout — API แอดมินต้องเรียก `requireAdmin()` อีกชั้น
- ดิสก์ exFAT จะมีไฟล์ `._*` จาก macOS — git-ignore ไว้แล้ว ข้ามได้
