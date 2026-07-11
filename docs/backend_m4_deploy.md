# Backend — M4 Go-live / Deploy (B4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Production live:** https://horaai.vercel.app (Vercel project `son-s-projects6/hora_ai`)
- ✅ Supabase prod — migrations up to date + seed รันแล้ว
- ✅ Env บน Vercel Production (14 ตัว) + `AUTH_URL`/`APP_BASE_URL` ชี้ domain จริง
- ✅ Smoke public API 5/5 ผ่าน
- 🟡 **Manual smoke** ยังต้องทดสอบ sign-in → birth → payment → แชท Gemini ด้วยมือ

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Deploy production ผ่าน `npx vercel --prod` (alias `horaai.vercel.app`)
- `scripts/sync-vercel-env.mjs` + `npm run deploy:env` — push `.env` → Vercel อย่างปลอดภัย
- `.vercelignore` — ห้ามอัปโหลด `.env` ไปกับ deployment อีก
- `npm run db:migrate:deploy` — คำสั่ง migrate บน production (ใช้ `DIRECT_URL`)
- `npm run smoke:public` กับ `SMOKE_BASE_URL=https://horaai.vercel.app` — ผ่านครบ

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- **[Deploy แรก bundle .env]:** Vercel เตือน "Detected .env file" — แก้ด้วย `.vercelignore` + sync env ผ่าน dashboard/CLI แล้ว redeploy
- **[GitHub ↔ Vercel]:** `vercel link` ไม่สามารถ connect repo `Markrock342/astrology_ai` ได้ (สิทธิ์) — deploy ผ่าน CLI ได้ปกติ

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)

### ต้องทำ manual (ไม่ใช่โค้ด)
- [ ] **Google OAuth:** เพิ่ม Authorized redirect URI  
  `https://horaai.vercel.app/api/auth/callback/google` ใน Google Cloud Console
- [ ] **Manual smoke:** sign-in (Google + email) → birth profile → admin approve payment → แชท Pro → Gemini ตอบ
- [ ] **Merge `be/m4-rate-limit` → `main`** เพื่อให้ GitHub/Vercel auto-deploy รอบถัดไป (ถ้าเชื่อม repo ได้)

### Optional env (ยังไม่ sync — ไม่มีใน local `.env`)
| ตัวแปร | ผลถ้าไม่ตั้ง |
|--------|-------------|
| `RESEND_API_KEY` + `EMAIL_FROM` | อีเมล reset/verify log ใน console แทนส่งจริง |
| `TURNSTILE_*` | ไม่มี bot protection บนฟอร์ม auth |
| `UPSTASH_*` | rate-limit ใช้ in-memory per instance |
| `OPENAI_API_KEY` | ไม่มี OpenAI fallback ใน Admin CMS |

เพิ่มใน local `.env` แล้วรัน `npm run deploy:env` อีกครั้ง

## Checklist งานต่อไป (Next Steps)
- [x] Supabase migrate + seed prod
- [x] Vercel env + deploy
- [x] Smoke public APIs
- [ ] Google OAuth redirect URI
- [ ] Manual end-to-end smoke
- [ ] (Optional) Upstash + Resend + Turnstile บน Vercel

### คำสั่งอ้างอิง
```bash
# migrate บน production
npm run db:migrate:deploy
npm run db:seed

# sync env จาก .env ไป Vercel (ตั้ง PRODUCTION_URL ถ้า domain เปลี่ยน)
PRODUCTION_URL=https://horaai.vercel.app npm run deploy:env

# deploy
npx vercel --prod --yes

# smoke หลัง deploy
SMOKE_BASE_URL=https://horaai.vercel.app npm run smoke:public
```
