# Frontend — App UI ตาม Horasard mockups (M2)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **UI หลักตาม mockups บน main** — sign-in, onboarding/birth, chat, account, admin CMS shell; merge ผ่าน `fe/ui-milestone2` และ commit `0250fd7`

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/components/app/app-shell.tsx` — sidebar + mobile nav, collapse animation
- `src/components/app/chat-view.tsx` — แชท UI, เรียก `POST /api/horoscope/readings`, error states, typewriter
- `src/components/birth/birth-form.tsx` — ฟอร์มวันเกิด พ.ศ./ค.ศ., จังหวัด/อำเภอ, `PUT /api/me/birth-profile`
- `src/components/account/account-view.tsx` — แพ็กเกจ/เครดิตจาก `/api/me`, `/api/packages`
- `src/components/auth/sign-in-form.tsx` — login + Google + แสดง/ซ่อนรหัสผ่าน
- Admin: `packages-manager`, `prompts-manager`, `ai-configs-manager`, `knowledge-manager`, `admin/ui.tsx`
- `src/app/globals.css` — dark astrology theme, Noto Sans Thai (`f74fde5`)
- `src/config/features.ts` — ซ่อน AI chat / Admin AI ตาม phase

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ESLint `setState` ใน `useEffect` ที่ `chat-view.tsx`
  - [วิธีที่ลองแก้]: เพิ่ม `eslint-disable-next-line` สำหรับ reset thread เมื่อเปลี่ยนหมวด (`0250fd7`)
- [ปัญหา]: Sidebar collapse bug
  - [วิธีที่ลองแก้]: แก้ใน `app-shell.tsx` (`6de3053`, `0250fd7`)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `history/page.tsx` ยัง stub — รอ `GET /api/conversations` (M3)
- แชทยังไม่โหลดเธรดเก่าจาก API — state อยู่แค่ใน client
- หน้า `/admin/usage` ยังไม่ดึงข้อมูลจริง

## Checklist งานต่อไป (Next Steps)
- [ ] เชื่อม history กับ conversations API (M3)
- [ ] แสดง `suggestedQuestions` จาก categories API
- [ ] E2E / component test สำหรับ birth-form + chat flow
