# 🟦 Frontend — งานของคุณ (HoraSard)

คู่มือเฉพาะ Frontend dev อ่านคู่กับ `README.md` (สถาปัตยกรรม + วิธีรัน)
ฝั่ง Backend อยู่ในไฟล์ `BACKEND_TASKS.md`

**ขอบเขตของคุณ:** หน้าเว็บ + UI + client state
**โฟลเดอร์ที่ดูแล:** `src/app/(public|app|admin)/`, `src/components/`
**คุยกับ Backend ผ่าน JSON API เท่านั้น** — ห้ามเรียก AI/DB ตรงจากหน้าเว็บ

---

## 1. Git workflow (อ่านก่อนเริ่ม — สำคัญที่สุด)

เราใช้ **feature branch + Pull Request** ไม่ใช่ branch ถาวรต่อคน

### กติกา 6 ข้อ

1. **ห้าม push ตรงเข้า `main`** — `main` ต้องรันได้เสมอ
2. **1 งาน = 1 branch สั้นๆ** อายุ 1-3 วัน แล้ว merge กลับ (อย่าดองไว้นาน)
3. **ก่อนเริ่มงานทุกครั้ง** ดึงล่าสุดก่อน: `git checkout main && git pull`
4. **PR เล็กๆ** ดีกว่า PR ใหญ่ก้อนเดียว
5. **PM รีวิวแล้วค่อย merge** เข้า `main`
6. **คุยกับ Backend ก่อนแก้ไฟล์กลาง** (ดูข้อ 4)

### ชื่อ branch: `fe/<งาน>`  เช่น `fe/login-page`, `fe/reading-ui`

### ขั้นตอนทำงาน (ทำซ้ำทุกงาน)

```bash
git checkout main
git pull                          # ดึงล่าสุดก่อนเสมอ
git checkout -b fe/login-page     # แตก branch ใหม่จาก main

# ...เขียนโค้ด...
npm run typecheck && npm run lint # เช็คก่อน commit

git add -A
git commit -m "feat(login): add login form and validation"
git push -u origin fe/login-page  # push branch ของตัวเอง

# เปิด PR บน GitHub → รอ PM รีวิว → merge → ลบ branch
```

### ถ้าเจอ conflict

```bash
git checkout main && git pull
git checkout fe/login-page
git merge main        # แก้ conflict ในไฟล์ที่ชนกัน — ไม่แน่ใจให้ถาม PM ก่อน
```

---

## 2. Checklist ราย Milestone

> ค่าเริ่มต้นบางอย่างยังรอลูกค้ายืนยัน (ดูท้ายไฟล์) — ทำตาม default ไปก่อนได้

### 🎯 Milestone 2 — Auth, Birth Profile, Free/Pro, Admin UI พื้นฐาน

- [ ] หน้า Landing เต็ม (hero, categories, Free vs Pro, how-it-works, FAQ, footer)
- [ ] หน้า Register / Login / Forgot password (ต่อ API + แสดง error)
- [ ] หน้า Onboarding (ฟอร์ม birth profile + validation ฝั่ง client)
- [ ] Dashboard: แพ็กเกจ + เครดิตคงเหลือ + รายการหมวด (ล็อก Pro)
- [ ] Sidebar (desktop) + bottom nav (mobile)
- [ ] Admin UI: ตารางผู้ใช้ + หน้ารายละเอียด + ฟอร์มปรับสิทธิ์/เครดิต
- [ ] Admin UI: หน้าจัดการ categories, packages

**Acceptance ฝั่งคุณ:** ทุกฟอร์มต่อ API ได้ · แสดง loading/error ครบ · responsive เบื้องต้น

### 🎯 Milestone 3 — Reading Flow, History, Admin config UI

- [ ] หน้าดูดวง: เลือกหมวด → กรอกคำถาม → ส่งพร้อมส่ง header `Idempotency-Key`
- [ ] ครบทุก state: loading · AI processing · success · no-quota · locked · timeout · error · **retry (ปุ่มลองใหม่ต้องใช้ Idempotency-Key เดิม เพื่อไม่หักเครดิตซ้ำ)**
- [ ] แสดงผลคำอ่านแบบมีโครงสร้าง (title / summary / interpretation / strengths / cautions / guidance / closing)
- [ ] History list + filter ตามหมวด + หน้ารายละเอียด
- [ ] Admin UI: จัดการ prompt/persona, AI models (+ ปุ่ม Test), ตาราง Usage logs

**Acceptance ฝั่งคุณ:** เลือกหมวด → เห็นผล AI · state ครบ · retry ไม่ยิงซ้ำแบบสร้าง reading ใหม่ · history เปิดดูได้

### 🎯 Milestone 4 — Polish

- [ ] ขัด UX/UI · responsive ทุกหน้า (มือถือ / แท็บเล็ต / จอใหญ่)
- [ ] Empty state, error state, loading skeleton ให้เนียน
- [ ] ธีมมืดสไตล์โหราศาสตร์ให้สม่ำเสมอ (ใช้ตัวแปรสีใน `globals.css`)

---

## 3. เทคนิค & จุดที่ต้องรู้

- **UI มืดสไตล์โหราศาสตร์** ตั้งไว้ใน `src/app/globals.css` แล้ว (ตัวแปร `--primary`, `--accent`, `--surface` ฯลฯ) — อย่า hard-code สี
- แทนที่ placeholder `ScaffoldNote` ในแต่ละหน้าได้เลย (ลบ `src/components/scaffold-note.tsx` เมื่อไม่มีหน้าไหนใช้แล้ว)
- **Auth:** ใช้ `signIn` / `signOut` จาก NextAuth; สมัครสมาชิกยิงไปที่ `POST /api/auth/register`
- **การดูดวง:** สร้าง `Idempotency-Key` (UUID) ตอนเปิดฟอร์ม แล้วส่งเป็น header เดิมทุกครั้งที่กด (รวมถึงปุ่ม retry) → กันหักเครดิตซ้ำ
- แนะนำเพิ่ม shadcn/ui สำหรับ component พื้นฐาน (ปุ่ม, input, dialog)
- font ไทยตั้งไว้แล้ว (Noto Sans Thai) — ใช้ `font-sans` ได้เลย

---

## 4. สัญญากับ Backend (contract)

ทุก API ตอบรูปแบบเดียวกัน:

```jsonc
// สำเร็จ
{ "ok": true, "data": { /* ... */ } }
// ล้มเหลว
{ "ok": false, "error": { "code": "NO_QUOTA", "message": "..." } }
```

โค้ด error ที่ต้องแมปเป็น state บนหน้าดูดวง:
`NO_QUOTA` (เครดิตหมด) · `CATEGORY_LOCKED` (หมวด Pro) · `AI_TIMEOUT` · `AI_PROVIDER_ERROR` · `USER_DISABLED` · `RATE_LIMITED` · `VALIDATION`

**ไฟล์กลางที่ต้องคุยกับ Backend ก่อนแก้:**
`src/types/index.ts` (เช่น `HoroscopeResponse`) · `src/lib/schemas.ts` (รูปแบบ request) · `src/config/constants.ts` · `package.json`

---

## 5. รอลูกค้ายืนยัน (มีผลกับ UI — ถาม PM)

- รายการ categories สุดท้าย + อันไหน Free / Pro
- ต้องมีปุ่ม Google login ไหม
- ถามแบบพิมพ์เอง / เลือกคำถามสำเร็จรูป / ทั้งคู่
- แบรนด์/โลโก้/สี/ฟอนต์สุดท้าย
- ความยาวคำตอบ Free vs Pro
