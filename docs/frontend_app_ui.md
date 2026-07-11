# Frontend — App UI ตาม Horasard mockups

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **UI หลักครบบน main** — auth-card, onboarding/birth, chat, account, payment, admin CMS ทุกหน้า, legal scaffold
- 🟡 **F1–F4 ค้าง:** error-state chat, thread render หลัง B1, polish, legal content จริง

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/components/auth/auth-card.tsx` — login/register/forgot/reset หน้าเดียว + Turnstile
- `src/components/app/app-shell.tsx` — sidebar + mobile nav
- `src/components/app/chat-view.tsx` — แชท + `suggestedQuestions` + conversations API
- `src/components/birth/birth-form.tsx` + `birth-profile-gate.tsx`
- `src/components/account/account-view.tsx`, `payment-submit-card.tsx`
- Admin: dashboard, users, payments, prompts, ai-configs, knowledge, usage, FAQ, announcements, settings, audit
- Legal: `(public)/privacy`, `terms`, `disclaimer`
- `src/config/features.ts` — phase gating

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: ESLint `setState` ใน `useEffect` ที่ `chat-view.tsx`
  - [วิธีที่ลองแก้]: eslint-disable สำหรับ reset thread เมื่อเปลี่ยนหมวด
- [ปัญหา]: Sidebar collapse bug — แก้ใน `app-shell.tsx`

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- F2: render ประวัติเธรดเต็ม — รอ B1 multi-turn backend
- F1: error-state ครบทุกโค้ด + retry idempotency key เดิม
- F4: เนื้อหา legal จริง (หน้า scaffold มีแล้ว)

## Checklist งานต่อไป (Next Steps)
- [ ] F1: QA error-state แชท
- [ ] F2: history/thread หลัง B1 merge
- [ ] F3: responsive + skeleton polish
- [ ] F4: legal content จริง
