# 🟦 Frontend — งานรอบนี้ (มอบโดย PM · 11 ก.ค. 2026)

อ่านคู่กับ `FRONTEND_TASKS.md` · เริ่มจาก `main` ล่าสุดเสมอ

**สถานะตอนมอบงาน:** F1 / F3 / F4 merged แล้ว · **B1 (multi-turn backend) อยู่บน `main` แล้ว** → เริ่ม **F2 ได้ทันที**

---

## งานหลัก: F2 — ประวัติเธรดเต็ม + multi-turn

### ทำไมต้องทำ
ตอนนี้แชทยังยิง `POST /api/horoscope/readings` (Q&A ครั้งเดียว)  
Backend มี multi-turn แล้วผ่าน **Conversation + Message** แต่ FE ยังไม่ได้ต่อ → ประวัติเปิดกลับมาไม่ครบ / ถามต่อในเธรดเดิม AI ไม่ได้บริบทจริงจาก UI

### Branch
```bash
git checkout main && git pull
git checkout -b fe/f2-multi-turn-thread
```

### สิ่งที่ต้องทำ

1. **สร้าง / ใช้ conversationId**
   - เริ่มแชทใหม่ → `POST /api/conversations` `{ categorySlug, mode }` เก็บ `id`
   - มี `?thread=` → ใช้ id นั้นต่อ (อย่าสร้างเธรดใหม่)

2. **ส่งข้อความผ่าน messages API**
   - เปลี่ยนจาก `POST /api/horoscope/readings`
   - เป็น `POST /api/conversations/:id/messages`
   - header `Idempotency-Key` เดิม (retry ใช้ key เดิม — F1 ทำไว้แล้ว อย่าพัง)

3. **โหลดประวัติเธรดเต็ม**
   - `GET /api/conversations/:id` → เรนเดอร์ข้อความทั้งหมด (user/assistant)
   - skeleton ตอนโหลดมีแล้ว (`loadingThread`) — เก็บไว้
   - โหลดเสร็จแล้วพิมพ์ต่อในเธรดเดิมได้ (multi-turn)

4. **Sidebar / history**
   - ลิงก์ประวัติชี้ `?thread=<conversationId>` ให้ตรง API ใหม่
   - คุยกับ BE ถ้า list ยังคืน reading id เก่า (BE มีงานคู่ใน `BE_ASSIGN.md`)

### ไฟล์หลักที่แตะ
- `src/components/app/chat-view.tsx` ← หัวใจ
- `src/components/app/app-shell.tsx` / `history/page.tsx` (ลิงก์ thread)
- อย่าแตะ `src/server/*` โดยไม่คุย BE

### Acceptance (DoD)
- [ ] เปิดประวัติจาก sidebar → เห็นข้อความเก่าครบ ไม่ใช่แค่คู่ Q&A เดียว
- [ ] ในเธรดเดิมถามต่อได้หลายรอบ (UI ส่ง `conversationId` ถูกต้อง)
- [ ] retry ยังใช้ `Idempotency-Key` เดิม
- [ ] Free ยังโดน `CHAT_REQUIRES_PRO` / UpgradeProState ตามเดิม
- [ ] `npm run typecheck` + `npm run lint` ผ่าน
- [ ] เปิด PR → รอ PM merge

### อย่าทำรอบนี้
- Voice / โทร (Phase 2)
- Engine chart UI (PM ทำแยก)
- เปลี่ยนธีม / redesign ทั้งหน้า

---

## หลัง F2 (ถ้าเหลือเวลา)
- smoke กับ BE: Pro แชท 3 รอบในเธรดเดียว → refresh หน้า → ประวัติครบ
- แจ้ง PM เมื่อ PR พร้อม

**ติดปัญหา / API ไม่ตรง → ทัก PM ก่อนเดา contract เอง**
