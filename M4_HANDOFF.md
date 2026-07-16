# 🏁 HoraSard — M4 Handoff (พร้อมส่งมอบ)

> อัปเดต: **12 ก.ค. 2026** · branch `main` · หลัง UX polish + Wave D transit UI  
> เอกสารนี้แทนสถานะเก่าในหัวข้อ “ค้าง B1–F4” ของฉบับ 10 ก.ค.

---

## 0. TL;DR

| ข้อ | สถานะ |
|-----|--------|
| โค้ด M1–M4 บน `main` | ✅ ครบ |
| Production deploy + env หลัก | ✅ |
| Manual E2E smoke (มือ) | ⬜ ต้องรันครั้งสุดท้ายก่อนส่งลูกค้า |
| Google OAuth redirect URI | ⬜ ตรวจใน Google Console ให้ตรงโดเมนจริง |
| Upstash Redis | ⚪ Optional — มี in-memory fallback |

**สรุป:** ฟีเจอร์พร้อม handoff แล้ว เหลือแค่ **ยืนยันด้วยมือ** บน production + ตั้ง OAuth URI ถ้าใช้ Google login

---

## 1. สถานะ Milestone

| # | ขอบเขต | สถานะ |
|---|--------|--------|
| **M1** | Schema, service layer, seed | ✅ |
| **M2** | Auth, birth, Free/Pro, admin พื้นฐาน, UI | ✅ |
| **M3** | Gemini chat, multi-turn, credit, ประวัติ, AI CMS | ✅ |
| **M4** | Payment, dashboard, rate-limit, deploy, polish, legal, transit UI | ✅ โค้ด |

---

## 2. Definition of Done (โค้ด) — ปิดแล้ว

- [x] B1 multi-turn chat + credit ถูก
- [x] B2 tests (credit / lock / idempotency / payment / rate-limit / thread)
- [x] B3 Upstash rate-limit + in-memory fallback
- [x] B4 deploy docs + `smoke:public` + `deploy:env`
- [x] F1 chat error-state + Idempotency-Key retry
- [x] F2 ประวัติเธรดเต็ม + multi-turn UI
- [x] F3 polish (skeleton, responsive, nav progress, theme)
- [x] F4 legal จาก CMS
- [x] Wave D — UI ฟอร์มดวงจร (`TransitFormModal` + Pro gate)
- [x] Engine scrape-first + ตารางหลักฐานดวง
- [x] Free ห้ามแชท (`CHAT_REQUIRES_PRO` / `canChat: plan === "PRO"`)
- [x] Admin AI CMS: prompts/persona + knowledge inject + ai-configs + usage

---

## 3. Flow ที่พร้อม demo

1. Landing → **เริ่มต้นใช้งาน** (register) / **เข้าสู่ระบบ** (login)  
2. กรอกวันเกิด → เข้าแชท  
3. Free: เห็นหมวด / ล็อก Pro / อัปเกรดที่ `/account`  
4. ส่งสลิป manual → Admin อนุมัติ → Pro  
5. แชทหลาย turn + ตารางหลักฐาน + ประวัติ sidebar  
6. **ดวงจร:** แถบข้าง → เริ่มดวงจรใหม่ → กรอกวันเวลา → สนทนา  
7. ตั้งค่า: กดโปรไฟล์ · ธีม: ไอคอนอาทิตย์/พระจันทร์  

### 3.1 Admin AI หลังบ้าน (บุคลิก + ความรู้) — **มีครบ ไม่ใช่งานค้าง**

| หน้า | ทำอะไร | ผลต่อแชท |
|------|--------|----------|
| `/admin/prompts` **บุคลิก AI** | แก้ system / persona / output format (draft → publish) | เข้า `buildSystemPrompt` ทุกครั้งที่ยิง Gemini |
| `/admin/knowledge` **คลังความรู้** | ตำรา/FAQ ต่อหมวดหรือทั้งระบบ (เปิดใช้ + publish) | inject เป็นบล็อก “ความรู้อ้างอิง” ใน system prompt |
| `/admin/ai-configs` **โมเดล AI** | Gemini / OpenAI-compatible + Base URL, วาง API key (เข้ารหัส), test/health รายโมเดล | สร้างต้องมี `apiKey`; ผูกหมวด/แพลนที่ฟอร์มนี้ |
| `/admin/categories` | ผูก `promptTemplateId` ต่อหมวด | ผูกโมเดลทำที่ AI Configs → หมวด ไม่ใช่หน้านี้ |
| `/admin/usage` | ดู log การเรียก AI | ไม่หักเครดิตตอน test |

เงื่อนไข: `NEXT_PUBLIC_APP_PHASE≥3` (หรือไม่ตั้งใน dev) → `FEATURES.aiAdmin` + `aiChat` เปิด  
รายละเอียด: `docs/backend_ai_admin.md`

**Smoke แอดมิน (แนะนำก่อนส่งลูกค้า):**
1. Login admin → แก้ persona แล้ว publish  
2. เพิ่ม knowledge เปิดใช้ → ถามแชท Pro ว่าตอบอ้างอิงเนื้อหานั้นได้ไหม  
3. AI Configs → กด Test โมเดล (ไม่หักเครดิต)  

---

## 4. Production / Env

| รายการ | หมายเหตุ |
|--------|----------|
| GitHub | `Markrock342/astrology_ai` |
| Vercel (ล่าสุดในงานนี้) | `worameths-projects-22ccbdc4/astrology-ai` → มักเป็น `astrology-ai-three.vercel.app` |
| โดเมนใน docs เดิม | `horaai.vercel.app` — ยืนยันว่าเป็นโดเมนลูกค้าจริงก่อนส่ง |
| Env บน Production | DATABASE, AUTH, Google, Gemini, Resend, Turnstile, APP_PHASE, myhora scrape — มีแล้ว |
| `UPSTASH_*` | ยังไม่จำเป็น (fallback in-memory) |

### ก่อน go-live มือ (checklist)

- [ ] เปิด production URL ที่จะส่งลูกค้า (ปิด Vercel SSO ถ้ายังเปิดอยู่)
- [ ] Google Cloud → Authorized redirect URI = `{AUTH_URL}/api/auth/callback/google`
- [ ] Smoke: register/login → birth → payment approve → Pro chat 3 รอบ → refresh ประวัติ → ดวงจร 1 รอบ
- [ ] Admin: อนุมัติ payment, ดู dashboard KPI
- [ ] (ถ้าต้องการ) `npm run smoke:public` กับ `SMOKE_BASE_URL=<prod>`

---

## 5. สิ่งที่ไม่บล็อก handoff

- Preset ดวงจรแบบ myhora (new moon / eclipse) — ยังเลือกวันตรงๆ ได้
- Chart snapshot ในประวัติย้อนหลัง (แสดงตอนตอบสดแล้ว)
- OpenAI fallback key (optional)
- Wave อื่นนอก scope Phase 1

---

## 6. เอกสารคู่กัน

| ไฟล์ | ใช้ทำอะไร |
|------|-----------|
| `BE_ASSIGN.md` / `FE_ASSIGN.md` | สถานะงานรอบล่าสุด |
| `BACKEND_TASKS.md` / `FRONTEND_TASKS.md` | checklist ราย milestone |
| `docs/backend_m4_deploy.md` | วิธี deploy / env |
| `docs/newhora-integration.md` | engine + scrape |
| `.env.example` | รายการตัวแปร |

---

## 7. คำสั่งตรวจเร็ว

```bash
npm run typecheck
npm test
SMOKE_BASE_URL=https://<your-prod-host> npm run smoke:public
```

*Handoff นี้หมายถึง “โค้ดและ config พร้อมส่ง” — ปิด milestone ฝั่งลูกค้าหลังผ่าน manual smoke ด้านบน*
