# 🟩 Backend — งานของคุณ (HoraSard)

คู่มือเฉพาะ Backend dev อ่านคู่กับ `README.md` (สถาปัตยกรรม + วิธีรัน)
ฝั่ง Frontend อยู่ในไฟล์ `FRONTEND_TASKS.md`

**ขอบเขตของคุณ:** service layer + API + ฐานข้อมูล + AI integration
**โฟลเดอร์ที่ดูแล:** `src/server/`, `src/app/api/`, `prisma/`
**กฎเหล็ก:** business logic อยู่ใน `src/server/*` เท่านั้น — route handler แค่ validate + authorize + เรียก service

---

## 1. Git workflow (อ่านก่อนเริ่ม — สำคัญที่สุด)

เราใช้ **feature branch + Pull Request** ไม่ใช่ branch ถาวรต่อคน

### กติกา 6 ข้อ

1. **ห้าม push ตรงเข้า `main`** — `main` ต้องรันได้เสมอ
2. **1 งาน = 1 branch สั้นๆ** อายุ 1-3 วัน แล้ว merge กลับ (อย่าดองไว้นาน)
3. **ก่อนเริ่มงานทุกครั้ง** ดึงล่าสุดก่อน: `git checkout main && git pull`
4. **PR เล็กๆ** ดีกว่า PR ใหญ่ก้อนเดียว
5. **PM รีวิวแล้วค่อย merge** เข้า `main`
6. **คุยกับ Frontend ก่อนแก้ไฟล์กลาง** (ดูข้อ 4)

### ชื่อ branch: `be/<งาน>`  เช่น `be/auth-api`, `be/gemini-adapter`

### ขั้นตอนทำงาน (ทำซ้ำทุกงาน)

```bash
git checkout main
git pull                          # ดึงล่าสุดก่อนเสมอ
git checkout -b be/auth-api       # แตก branch ใหม่จาก main

# ...เขียนโค้ด...
npm run typecheck && npm run lint # เช็คก่อน commit

git add -A
git commit -m "feat(auth): implement register + credit grant"
git push -u origin be/auth-api    # push branch ของตัวเอง

# เปิด PR บน GitHub → รอ PM รีวิว → merge → ลบ branch
```

### ถ้าเจอ conflict

```bash
git checkout main && git pull
git checkout be/auth-api
git merge main        # แก้ conflict ในไฟล์ที่ชนกัน — ไม่แน่ใจให้ถาม PM ก่อน
```

### เวลาแก้ schema ต้องสร้าง migration ด้วยเสมอ

```bash
npm run db:migrate    # prisma migrate dev — commit ไฟล์ migration ไปพร้อมกัน
npm run db:generate   # ถ้าจำเป็น
```

---

## 2. Checklist ราย Milestone

> ค่า default ยังรอลูกค้ายืนยัน (ดูท้ายไฟล์) — ทำเป็น config/seed ไปก่อน

### 🎯 Milestone 2 — Auth, Birth Profile, Free/Pro, Admin API พื้นฐาน

- [ ] `POST /api/auth/register` — ต่อจริง + validation (มีโครงแล้ว)
- [ ] Login ผ่าน NextAuth Credentials — ทดสอบ session/role (จบใน `src/server/auth/config.ts`)
- [ ] `POST /api/auth/forgot-password` (ยืนยันกับ PM ว่าส่งอีเมลจริงไหม)
- [ ] Google provider (ถ้าลูกค้ายืนยันว่าต้องมี — เปิดใน `src/auth.ts`)
- [ ] `GET/PUT /api/me/birth-profile`
- [ ] `GET /api/me`, `GET /api/me/package`, `GET /api/me/credits`
- [ ] Admin: `GET /api/admin/users`, `GET /api/admin/users/:id`
- [ ] Admin: `PATCH /api/admin/users/:id/status` (+ `writeAudit`)
- [ ] Admin: `POST /api/admin/users/:id/credits` (ผ่าน credit-service + `writeAudit`)
- [ ] Admin: `PUT /api/admin/users/:id/subscription` (ตั้ง Free/Pro + วันหมดอายุ)
- [ ] Admin CRUD: categories, packages

**Acceptance ฝั่งคุณ:** register/login ได้ · birth profile บันทึกได้ · admin ดึงผู้ใช้ได้ · Free/Pro มีผลจริง

### 🎯 Milestone 3 — Gemini, Reading Flow, Credit/Quota, History

- [ ] `src/server/ai/providers/gemini.ts` — เรียก Gemini จริง + `AbortController(timeoutMs)`; ใช้ `resolveSecret(secretReference)`
- [ ] **ห้าม throw เมื่อ provider error** — คืน `{ ok:false, errorCode }` เพื่อให้ router ทำ fallback และ **ไม่หักเครดิต**
- [ ] Validate output เป็น `HoroscopeResponse` ก่อน save
- [ ] ตรวจ `reading-service.ts` ให้ครบ flow (หักเครดิตหลังสำเร็จ + idempotency + fallback)
- [ ] `GET /api/me/history`, `GET /api/me/history/:id` (เช็ค ownership)
- [ ] Admin CRUD: prompts, ai-configs + `POST /api/admin/ai-configs/:id/test`
- [ ] `GET /api/admin/ai-usage` (รวม cost / latency / error)
- [ ] Tests: หักเครดิต · refund เมื่อ AI error · สิทธิ์ Free/Pro · model routing · admin auth · idempotency กันกดซ้ำ

**Acceptance ฝั่งคุณ:** AI ตอบและ save ได้ · หักเครดิตถูกต้อง · AI error ไม่หักซ้ำ · retry ไม่สร้าง reading ซ้ำ · admin แก้ prompt/model ได้

### 🎯 Milestone 4 — Payment, Dashboard, Deploy

- [ ] Rate-limit auth + reading endpoints (production-grade เช่น Redis/Upstash แทน in-memory)
- [ ] Manual payment: `POST /api/payments/manual` + admin review + เปิดแพ็กเกจ (+ audit)
- [ ] `GET /api/admin/dashboard` — สรุปตัวเลข + ต้นทุน AI
- [ ] Production DB + secrets + backup

---

## 3. สิ่งที่เขียนไว้ให้แล้ว (ใช้ซ้ำ อย่าเขียนใหม่)

- `src/server/credit/credit-service.ts` — หักเครดิต atomic + optimistic lock + ledger immutable → **ทุกการเปลี่ยนเครดิตต้องผ่านที่นี่ ห้ามแก้ `balance` ตรง**
- `src/server/horoscope/reading-service.ts` — flow เต็ม (charge-after-success + idempotency) เหลือแค่ต่อ Gemini จริง
- `src/server/ai/` — adapter interface · router (fallback) · prompt-builder · usage-logger
- `src/server/auth/rbac.ts` — `requireUser()`, `requireAdmin()`, `requireSuperAdmin()`
- `src/server/audit/audit-service.ts` — `writeAudit()` เรียกทุก admin mutation ที่ sensitive
- `src/lib/http.ts` — `handle()` ครอบ route handler, `ok()`, `fail()`
- `src/lib/errors.ts` — `AppError(code, msg)` แปลงเป็น HTTP อัตโนมัติ

**Pattern มาตรฐานของ route handler:**

```ts
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();          // หรือ requireAdmin()
    const data = someSchema.parse(await req.json());
    const result = await someService(user.id, data);
    return ok(result);
  });
}
```

---

## 4. สัญญากับ Frontend (contract)

ทุก API ตอบรูปแบบเดียวกัน: `{ ok:true, data }` หรือ `{ ok:false, error:{ code, message } }`
อย่าเปลี่ยนรูปแบบนี้โดยไม่บอก Frontend

**ไฟล์กลางที่ต้องคุยกับ Frontend ก่อนแก้:**
`prisma/schema.prisma` · `src/types/index.ts` · `src/lib/schemas.ts` · `src/config/constants.ts` · `package.json`

---

## 5. ความปลอดภัย (ห้ามพลาด)

- API key อยู่ใน env เท่านั้น — DB เก็บแค่ชื่อ secret (`secretReference`) ห้ามเก็บ key จริง
- ห้าม log password / API key
- ทุก admin route เรียก `requireAdmin()` ฝั่ง server เสมอ (อย่าเชื่อ client)
- ทุกอย่างที่แตะเครดิต + สร้าง reading ต้องอยู่ใน DB transaction เดียวกัน
- เก็บวันเวลาเป็น UTC เสมอ (แสดงผลเป็นเวลาไทยที่ frontend)

---

## 6. รอลูกค้ายืนยัน (มีผลกับ backend — ถาม PM)

- Auth.js vs Supabase + ต้องมี Google login ไหม
- Birth fields สุดท้าย + ต้องมีสถานที่เกิดไหม
- Free/Pro quota + ราคา + credit cost ต่อหมวด (ตอนนี้: Free 3, Pro 100, 199฿)
- Pro หมดอายุรายเดือน หรือ manual ไม่มีกำหนด
- ใครถือบัญชี/จ่าย Gemini + hosting/Postgres
