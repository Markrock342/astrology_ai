# Backend — M3 Chat conversations API

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M3 + UX Wave F** — conversations, SSE phases, answerMode, followUps, chart memory
- ✅ **Message feedback** — `POST/DELETE /api/messages/:id/feedback`, ตาราง `message_feedback`, `GET /api/admin/feedback`
- ✅ **`assertFeedbackClient`** + tests — กัน Prisma client ค้างหลัง pull บน Windows

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Feedback API + admin list
- `assertFeedbackClient()` — ข้อความชัดเมื่อไม่มี `messageFeedback` (หยุด `npm run dev` แล้ว `prisma generate`)
- SSE status phases · answerMode · follow-up-suggestions · `done` มี `summaryLine` / `followUps` / `creditCost`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: `/admin/feedback` ขึ้น "เกิดข้อผิดพลาดชั่วคราว" ทั้งที่ migration รันแล้ว
  - [สาเหตุ]: Prisma client เก่า → `prisma.messageFeedback` = undefined
  - [วิธีแก้]: หยุด dev → `npx prisma generate` → restart; guard ใน `feedback-service.ts` (เช็ค delegate โดยตรง — อย่าใช้ `"messageFeedback" in prisma` กับ Proxy ใน `db.ts`)
- [ปัญหา]: Admin เห็นคำถามผิดคู่กับ thumbs-down
  - [วิธีแก้]: question lookup ไม่ filter `deletedAt` (commit `29a3ae7`)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- P1: `balanceAfter` ใน `done`
- Message pagination เธรดยาว (cap 200)
- Transit chart cache บน conversation (BE-E2.2)

## Checklist งานต่อไป (Next Steps)
- [x] UX-BE-F1.1–F1.3 / F2.1 feedback API + admin
- [x] `assertFeedbackClient` + feedback tests
- [ ] UX-BE-F2.2 `balanceAfter` ใน done (P1)
- [ ] Wave 4: message cursor pagination
