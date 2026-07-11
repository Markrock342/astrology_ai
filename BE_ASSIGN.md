# 🟩 Backend — งานรอบนี้ (มอบโดย PM · อัปเดต 12 ก.ค. 2026)

**สถานะ:** Thread API + B3 + B4 docs + engine scrape-first **อยู่ใน `main`** ผ่าน [PR #9](https://github.com/Markrock342/astrology_ai/pull/9)

อ่านคู่กับ `BACKEND_TASKS.md` · `docs/backend_m4_deploy.md`

## งาน A: Thread API ✅
- [x] list/detail Conversation+Message
- [x] เทส + merge

## งาน B: B4 Go-live — ค้าง manual
- [x] docs/scripts (`smoke:public`, `deploy:env`)
- [ ] ยืนยัน env production (รวม `ENABLE_MYHORA_SCRAPE`)
- [ ] Manual smoke: sign-in → birth → Pro chat → ตารางหลักฐาน → payment
- [ ] Google OAuth redirect URI (ถ้าใช้)

## งาน C: B3 Rate-limit ✅
- [x] Upstash + in-memory fallback ในโค้ด  
  ตั้ง `UPSTASH_REDIS_REST_URL` / `TOKEN` บน Vercel เมื่อพร้อม
