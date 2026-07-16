# Frontend — App UI ตาม Horasard mockups

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ Wave F FE (thinking, follow-ups, draft, ThemePicker, เครดิตข้างโปรไฟล์)
- ✅ **Logo & Theme** — `/admin/theme` อัปโหลด mark + wordmark + สี
- ✅ **อัปโหลดโลโก้ทุกโฮสต์** — Postgres `media_assets` + `GET /api/media/:id` (ไม่พึ่ง Vercel Blob)
- ✅ Mobile settings nav + admin «กลับแอป»
- Soft-nav (`fix/dashboard-soft-nav`) **ยังไม่รวม**

## งานที่เพิ่งทำเสร็จ (Recently Completed)

### Logo & Theme (host-agnostic)
- `CmsSiteTheme.markUrl` / `wordmarkUrl`; schema รับ path `/api/media/...`
- `POST /api/admin/upload` → `media_assets`; `GET /api/media/:id`
- `useSiteBrand` + `brand-logo.tsx` + fallback `/logo.png` `/wordmark.png`
- เมนู: «โลโก้ & ธีม»

### Mobile / admin shell
- dual-mount SettingsPopover → `settings-popover-outside.ts`
- `admin-shell.tsx` แสดงกลับแอปทุกขนาดจอ

### วิธีใช้โลโก้
1. `/admin/theme` → อัปโหลด mark/wordmark → บันทึกและเผยแพร่  
2. ไม่ต้องตั้ง Token เพิ่ม (ใช้ `DATABASE_URL` อย่างเดียว)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: อัปโหลดผูก Vercel / ต้องมี Supabase service role  
  - [วิธีแก้]: เก็บใน DB เสิร์ฟ `/api/media/:id`
- [ปัญหา]: มือถือตั้งค่าไม่ไปหน้าเป้าหมาย → dual-mount outside-click fix
- [ปัญหา]: มือถือแอดมินกลับแชทไม่ได้ → โชว์ลิงก์กลับแอป

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- สลิปโอนเงินยังใช้ Vercel Blob แยก
- ไม่รวมไอคอนหมวดหมู่ / favicon / PWA
- Soft-nav ยังไม่ merge

## Checklist งานต่อไป (Next Steps)
- [x] Logo & Theme UI + DB media upload
- [x] Mobile settings + admin back
- [ ] Smoke บน staging หลัง deploy
- [ ] พิจารณา merge `fix/dashboard-soft-nav`
