# 🟩 Backend — งานรอบนี้ (มอบโดย PM · 11 ก.ค. 2026)

อ่านคู่กับ `BACKEND_TASKS.md` · เริ่มจาก `main` ล่าสุดเสมอ

**สถานะตอนมอบงาน:** B1 (multi-turn prompt) + B2 (tests) **merged แล้ว** · M3 ปิดฝั่งโค้ดแชท  
งานถัดไป: **ปลดบล็อก F2** แล้วไป **B4 go-live**

---

## งาน A (ทำก่อน / คู่กับ FE F2): Thread API ให้ตรง Conversation

### ทำไมต้องทำ
`sendMessage` / B1 เก็บที่ `Conversation` + `Message` แล้ว  
แต่ `thread-service` ยังอ่านจาก `HoroscopeReading` (Q&A เก่า) → FE เปิด `?thread=` แล้วได้ประวัติไม่ครบ / id ไม่ตรง

### Branch
```bash
git checkout main && git pull
git checkout -b be/thread-conversation-api
```

### สิ่งที่ต้องทำ

1. **`listUserThreads` / `listTransitThreads`**
   - list จาก `Conversation` (ไม่ใช่ `HoroscopeReading`)
   - คืน `id`, `title`, `categorySlug`, `updatedAt` ให้ sidebar/history

2. **`getThreadDetail`**
   - โหลด `Message` ทั้งหมดของ conversation (เรียงเวลา)
   - shape ที่ FE ใช้ได้:
     ```jsonc
     {
       "id": "...",
       "categorySlug": "...",
       "categoryLabel": "...",
       "messages": [
         { "id": "...", "role": "user"|"assistant", "content": "...", "modelId?": "..." }
       ]
     }
     ```

3. **อย่าพัง route เดิม**
   - `GET/POST /api/conversations`
   - `POST /api/conversations/:id/messages` (มีอยู่แล้ว)

4. **เทส**
   - เพิ่ม/อัปเดตเทส thread list + detail (อย่างน้อย happy path + NOT_FOUND + ไม่เห็นเธรดคนอื่น)

### Acceptance (DoD)
- [ ] `GET /api/conversations` คืน conversation จริงหลังแชทผ่าน messages API
- [ ] `GET /api/conversations/:id` คืนข้อความหลายรอบครบ
- [ ] `npm test` + `npm run typecheck` ผ่าน
- [ ] เปิด PR → รอ PM merge (merge **ก่อนหรือคู่กับ** FE F2)

---

## งาน B: B4 — Go-live config (critical path)

### Branch
```bash
git checkout main && git pull
git checkout -b be/b4-golive-config
```

### Checklist
- [ ] ตรวจ env บน Vercel ครบตาม `.env.example` (อย่างน้อย):
  - `DATABASE_URL` / `DIRECT_URL`
  - `AUTH_SECRET` / `AUTH_URL`
  - `GEMINI_API_KEY`
  - Google / Resend / Turnstile ถ้าใช้จริง
  - `NEXT_PUBLIC_APP_PHASE` ตามที่ PM กำหนดตอนเปิด AI
- [ ] เอกสารขั้นตอน: migrate prod + seed (admin) + rollback/backup ย่อๆ ใน PR หรือ `docs/`
- [ ] Smoke หลัง deploy (เขียนผลใน PR):
  1. สมัคร / login
  2. กรอกวันเกิด
  3. Pro แชทอย่างน้อย 2 ข้อความในเธรดเดียว
  4. เปิดประวัติเธรดกลับมาได้
  5. ชำระเงิน manual (ถ้า staging มี)

### Acceptance
- [ ] staging หรือ prod preview รันได้ตาม smoke ด้านบน
- [ ] PR สรุป env ที่ต้องใส่ (ห้ามใส่ secret จริงใน repo)

---

## งาน C: B3 — Rate-limit (ทำขนานได้ ถ้ามีเวลา)

**ตัดสินใจ PM ชั่วคราว:** go-live รอบนี้ **ยอม in-memory ก่อนได้**  
ถ้าทำ B3: Upstash Redis + แทนที่ `src/lib/rate-limit.ts` ให้ทำงานบน serverless

- Branch: `be/b3-upstash-rate-limit`
- อย่าบล็อก B4 ถ้ายังไม่เริ่ม B3

---

## ลำดับที่แนะนำ

```
be/thread-conversation-api  →  merge  (ปลด F2)
        ↓
be/b4-golive-config         →  merge  → go-live
        ↓ (ขนานได้)
be/b3-upstash-rate-limit    →  optional รอบนี้
```

**อย่าทำรอบนี้:** Voice / STT · engine transit เต็ม (PM ทำแยก) · เปลี่ยน schema ใหญ่โดยไม่คุย

**ติดสัญญา API กับ FE → ทัก PM ก่อนแก้ response shape**
