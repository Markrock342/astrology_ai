# FE Smoke Report — Production (HANDOFF step 0)

**URL:** https://astrology-ai-three.vercel.app  
**วันที่:** 12 ก.ค. 2026  
**Deploy `main`:** `8e5968d` (หลัง revert e0 — ยังไม่มี drawer fix / F2 / E1.1 บน prod)

---

## Automated (ผ่าน)

| รายการ | ผล |
|--------|-----|
| `npm run smoke:public` (packages, geo, faq, settings, announcements) | **5/5 OK** |
| `/login` โหลดได้ | **200** — ฟอร์ม Google + อีเมลครบ |
| `/dashboard` ไม่ login | **redirect → /login** |
| `/api/me` ไม่ login | **401** |

---

## Manual checklist (ต้องล็อกอินบนมือถือ/เดสก์ท็อป)

| # | รายการ | สถานะ | หมายเหตุ |
|---|--------|--------|----------|
| 1 | Register / login | ⏳ รอทดสอบมือ | หน้า login โหลดปกติ · Turnstile ต้องทดบน browser จริง |
| 2 | Pro แชท + ดวงจร (transit) | ⏳ รอบัญชี Pro | ต้องมี subscription Pro บน prod |
| 3 | ประวัติเธรดหลัง refresh | ❌ ยังไม่ครบบน prod | **F2 ยังไม่ merge** (`fe/f2-multi-turn-thread`) — ยังเป็น Q&A เก่าหรือโหลดไม่ครบ |
| 4 | ส่งสลิป → banner “รออนุมัติ” | ⏳ รอทดสอบมือ | โค้ด `PendingPaymentBanner` อยู่บน `main` แล้ว — ต้องอัปสลิปจริงแล้วเช็ค shell |

---

## บั๊กที่พบ (ส่ง PM)

### P0 — มือถือกดไม่ค่อยติด (ยืนยันจาก smoke มือ)
- **อาการ:** ปิดเมนู hamburger แล้วกดอะไรในแอปไม่ติดชั่วครู่ / เปิด-ปิดเมนูเร็วแล้วเมนูหาย
- **สาเหตุ:** overlay drawer `opacity-0` ยังรับคลิก ~240ms + race timer
- **แก้แล้ว:** branch `fe/e0-mobile-drawer-fix` (`76132e9`) — **ยังไม่ merge prod**
- **Action:** เปิด PR → merge → deploy แล้ว re-smoke มือถือ

### P1 — ประวัติเธรด multi-turn ไม่ครบบน prod
- **แก้แล้วใน branch:** `fe/f2-multi-turn-thread` — รอ PR merge

### P2 — ยังไม่มีหน้า usage จริงบน prod
- **งาน:** FE-E1.1 mock อยู่ `fe/e1-usage-ui` — รอ PR + BE-E1.3 API

---

## คำสั่ง re-smoke

```bash
SMOKE_BASE_URL=https://astrology-ai-three.vercel.app npm run smoke:public
```

หลัง merge `fe/e0-mobile-drawer-fix` + deploy ใหม่ → ทดสอบมืออีกรอบ:
1. เปิดเมนู → เลือกหมวด → ปิดเมนู → แตะแชททันที (ต้องติด)
2. แตะโปรไฟล์ → settings popover → เลือกเมนู (ต้องไม่ปิดทันที)

---

**สรุป step 0:** automated ผ่าน · manual ค้างบัญชี Pro + สลิป · **บล็อกหลัก = merge e0 + F2 ก่อน prod จะผ่านครบ**
