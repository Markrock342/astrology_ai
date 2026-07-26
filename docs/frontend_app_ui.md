# Frontend — App UI ตาม Horasard mockups

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ Wave F FE (thinking, follow-ups, draft, ThemePicker, เครดิตข้างโปรไฟล์)
- ✅ **Logo & Theme** — `/admin/theme` อัปโหลด mark + wordmark + สี
- ✅ **อัปโหลดโลโก้ทุกโฮสต์** — Postgres `media_assets` + `GET /api/media/:id` (ไม่พึ่ง Vercel Blob)
- ✅ Mobile settings nav + admin «กลับแอป»
- ✅ **Dashboard soft-nav** — `useChatRouteSearchParams` sync `cat`/`thread`; `softNavigate` (null history state) + `router.push` เมื่อกลับจาก `/account`/`/onboarding`

## งานที่เพิ่งทำเสร็จ (Recently Completed)

### Soft-nav (merge `fix/dashboard-soft-nav`)
- `useChatRouteSearchParams` อ่าน `window.location` + listen `horasard:soft-nav` / `popstate`
- `softNavigate` ใช้ `history.*(null, …)` ไม่ส่ง `__NA` markers — แล้ว broadcast event
- จากตั้งค่ากลับแชท: soft ได้เฉพาะ same-pathname; cross-route ใช้ `router.push`
- tests: `tests/chat-route-search.test.ts`

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
- [ปัญหา]: จากหน้าตั้งค่า (เปลี่ยนวันเกิด `/onboarding`, จัดการแพ็กเกจ `/account`) คลิกพื้นดวงเดิม/ประวัติ/ดวงจรแล้วเนื้อหาไม่กลับไปแชท
  - [สาเหตุ]: soft `pushState` เปลี่ยน URL แต่ App Router ไม่สลับ `children`
  - [วิธีแก้]: `softNavigate` คืน false เมื่อ pathname ต่าง → `useChatNav` ใช้ `router.push`
- [ปัญหา]: กดเมนู sidebar แล้วหน้าไม่เปลี่ยน / ส่งข้อความแล้วขึ้นให้เลือกหมวด
  - [สาเหตุ]: `useSearchParams()` ไม่ sync กับ native history (โดยเฉพาะเมื่อส่ง `window.history.state` ที่มี `__NA`)
  - [วิธีแก้]: `softNavigate(..., null)` + `useChatRouteSearchParams()` ใน `chat-view` / `app-shell`
- [ปัญหา]: อัปโหลดผูก Vercel / ต้องมี Supabase service role  
  - [วิธีแก้]: เก็บใน DB เสิร์ฟ `/api/media/:id`
- [ปัญหา]: มือถือตั้งค่าไม่ไปหน้าเป้าหมาย → dual-mount outside-click fix
- [ปัญหา]: มือถือแอดมินกลับแชทไม่ได้ → โชว์ลิงก์กลับแอป

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- สลิปโอนเงินยังใช้ Vercel Blob แยก
- ไม่รวมไอคอนหมวดหมู่ / favicon / PWA
- Smoke มือบน staging หลัง deploy

## Checklist งานต่อไป (Next Steps)
- [x] Logo & Theme UI + DB media upload
- [x] Mobile settings + admin back
- [x] Merge dashboard soft-nav → `main`
- [ ] Smoke บน staging: หมวด + ประวัติ + ดวงจร + จาก account/onboarding กลับแชท + soft-nav ไม่ flash เต็มหน้า
