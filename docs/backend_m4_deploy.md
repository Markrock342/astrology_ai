# Backend — M4 Go-live / Deploy (B4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Code M4 ครบบน main** — payment, dashboard, subscription cancel, email sender
- 🟡 **B4 ค้างการตั้งค่า** — env production, migrate/seed prod, smoke test จริง (ไม่ใช่เขียนโค้ดเพิ่ม)
- ⏸️ **B3 รอ PM** — rate-limit Redis vs in-memory ([backend_m4_waitlist.md](./backend_m4_waitlist.md))

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `.env.example` — อัปเดตตัวแปร production ครบตาม `env.ts` + M4_HANDOFF §8
- `scripts/smoke-public-api.mjs` + `npm run smoke:public` — ตรวจ public API หลัง deploy
- `tests/payment-service.test.ts` — approve/reject payment flow
- เอกสารนี้ + waitlist

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีบันทึกใหม่

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ตั้ง env บน Vercel ต้องมีสิทธิ์ project + ค่าจริงจาก PM/ลูกค้า
- `db:migrate` + `db:seed` บน Supabase prod ต้องรันจากเครื่องที่มี `DIRECT_URL`
- Smoke test แบบเต็ม (sign-in → แชท → Gemini) ต้องทำ manual หรือ E2E ภายหลัง

## Checklist งานต่อไป (Next Steps)

### ก่อน deploy
- [ ] PM ยืนยัน `NEXT_PUBLIC_APP_PHASE` (unset / 2 / 3)
- [ ] PM ยืนยัน quota/ราคา (Free 3 / Pro 100 / 199฿)
- [ ] PM ตัดสินใจ B3 rate-limit ([waitlist](./backend_m4_waitlist.md))

### Supabase production
- [ ] ตั้ง `DATABASE_URL` (pooler port 6543, `?pgbouncer=true`)
- [ ] ตั้ง `DIRECT_URL` (session pooler port 5432) — ใช้เฉพาะ migrate
- [ ] รัน `npm run db:migrate` กับ prod `DIRECT_URL`
- [ ] รัน `npm run db:seed` (ครั้งแรกเท่านั้น หรือตามนโยบายทีม)
- [ ] ยืนยัน backup policy ใน Supabase dashboard

### Vercel environment (Production)
- [ ] `AUTH_SECRET` — `npx auth secret`
- [ ] `AUTH_URL` + `APP_BASE_URL` — domain จริง (https)
- [ ] `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — redirect URI ตรง domain prod
- [ ] `GEMINI_API_KEY` — จำเป็นสำหรับ AI chat
- [ ] `RESEND_API_KEY` + `EMAIL_FROM` — อีเมล reset/verify จริง
- [ ] `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (แนะนำ)
- [ ] `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — สำหรับ seed admin
- [ ] `NEXT_PUBLIC_APP_PHASE` — ตาม milestone ที่เปิดขาย
- [ ] `OPENAI_API_KEY` — ถ้าใช้ fallback provider ใน Admin CMS

### หลัง deploy
- [ ] `npm run smoke:public` กับ production URL
- [ ] Manual smoke: sign-in (Google + email) → birth profile → manual payment approve → แชท Pro → Gemini ตอบ
- [ ] ตรวจ admin dashboard KPIs แสดงตัวเลข

### คำสั่งอ้างอิง
```bash
# migrate บน production (ต้องมี DIRECT_URL ใน .env ชั่วคราว)
npm run db:migrate
npm run db:seed

# smoke public APIs หลัง deploy
SMOKE_BASE_URL=https://your-domain.com npm run smoke:public
```
