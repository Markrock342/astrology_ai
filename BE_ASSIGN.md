# 🟩 Backend — สถานะปิด M4 (อัปเดต 12 ก.ค. 2026)

**สถานะ:** โค้ด M4 ครบบน `main` · เหลือ manual go-live เท่านั้น

อ่านคู่กับ `M4_HANDOFF.md` · `BACKEND_TASKS.md` · `docs/backend_m4_deploy.md`

## ปิดแล้ว
- [x] Thread API + multi-turn (B1)
- [x] Tests credit/lock/idempotency/payment/rate-limit (B2)
- [x] Upstash rate-limit + in-memory fallback (B3)
- [x] Deploy docs + smoke/scripts (B4)
- [x] Engine scrape-first + transit create fields
- [x] Empty TRANSIT thread โหลดได้ (ก่อนข้อความแรก)
- [x] Admin AI CMS: prompts/persona + knowledge + ai-configs (inject เข้าแชท)

## ค้างมือ (ไม่ใช่โค้ด)
- [ ] Manual smoke production (รวมแก้บุคลิก/ความรู้แล้วถามแชท)
- [ ] Google OAuth redirect URI ตรงโดเมนจริง
- [ ] (Optional) `UPSTASH_*` บน Vercel
