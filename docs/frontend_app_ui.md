# Frontend — App UI ตาม Horasard mockups

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **UI หลักครบบน `main` @ `83d74af`** — auth, onboarding, chat ChatGPT-style (UX Wave F FE polish), account/usage, payment, admin CMS
- ✅ **Dashboard soft-nav** — `useChatRouteSearchParams` sync `cat`/`thread`; `shouldUseSoftChatNav` + `router.push` เมื่อกลับจาก `/account`/`/onboarding` บน branch `fix/dashboard-soft-nav`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- **Fix settings → chat stuck** — `useChatNav` ใช้ soft `pushState` เฉพาะบน `/dashboard`; จากตั้งค่า (`/account`, `/onboarding`) ใช้ `router.push` ให้ App Router เปลี่ยน children จริง; test `shouldUseSoftChatNav`
- **Fix soft-nav / sidebar dead** — `useChatRouteSearchParams` ใน `chat-nav.ts` อ่าน `window.location` + listen `horasard:soft-nav` / `popstate`; ใช้ใน `chat-view.tsx` และ `app-shell.tsx`; test `tests/chat-route-search.test.ts`
- UX Wave F FE P0 (บน `main` ผ่าน PR #16) — thinking 3-phase, credit under composer, follow-up chips, summary callout, answerMode toggle
- `chat-view.tsx` — SSE streaming, edit/regenerate, stop, markdown
- `app-shell.tsx` — sidebar + mobile nav + soft chat switches
- `chat-usage-bar.tsx` + `use-my-usage` — แสดงเครดิต/โควต้า

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: จากหน้าตั้งค่า (เปลี่ยนวันเกิด `/onboarding`, จัดการแพ็กเกจ `/account`) คลิกพื้นดวงเดิม/ประวัติ/ดวงจรแล้วเนื้อหาไม่กลับไปแชท
  - [สาเหตุ]: `useChatNav` ใช้ `history.pushState` เสมอ — URL เป็น `/dashboard?...` แต่ App Router ไม่สลับ `children` ยังค้างหน้าตั้งค่า
  - [วิธีแก้]: `shouldUseSoftChatNav` — soft เฉพาะเมื่ออยู่บน `/dashboard` ทั้งคู่; นอกนั้น `router.push`
- [ปัญหา]: กดเมนู sidebar (หมวด / ประวัติ / ดวงจร) แล้วหน้าไม่เปลี่ยน + ส่งข้อความได้แต่ขึ้น "เลือกหมวดจากแถบข้างก่อนเริ่มดูดวง"
  - [สาเหตุ]: `chat-nav` ใช้ `history.pushState` (soft nav) แต่ `useSearchParams()` ของ Next.js 16 **ไม่ sync** กับ native history → `cat` / `thread` ใน React ค้างเป็น `null`
  - [วิธีแก้]: เพิ่ม `useChatRouteSearchParams()` ใน `chat-nav.ts` — ใช้ใน `chat-view.tsx` และ `app-shell.tsx`
- [ปัญหา]: ESLint `setState` ใน `useEffect` ที่ `chat-view.tsx`
  - [วิธีที่ลองแก้]: eslint-disable สำหรับ reset thread เมื่อเปลี่ยนหมวด
- [ปัญหา]: Sidebar collapse bug — แก้ใน `app-shell.tsx`

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Soft-nav fix ยังอยู่บน `fix/dashboard-soft-nav` — รอ merge เข้า `main`
- Chat SSE turn/stale stability จาก `be/ux-wave-f` @ `cdb7ed4` ยังไม่เข้า `main` ชุดนี้
- Legal content จริงใน CMS (หน้า scaffold มีแล้ว)

## Checklist งานต่อไป (Next Steps)
- [ ] Merge `fix/dashboard-soft-nav` → `main` หลัง smoke ผ่าน (รวม soft query + hard กลับจากตั้งค่า)
- [ ] พิจารณาพอร์ต chat SSE stability จาก `be/ux-wave-f` ถ้ายังมีอาการ timeout/stack
- [ ] Smoke มือ: หมวด + ประวัติ + ดวงจร + จาก account/onboarding กลับแชท + soft-nav ไม่ flash เต็มหน้า
