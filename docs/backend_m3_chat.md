# Backend — M3 Chat conversations API

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M3 + post-M3 UX** — conversations, multi-turn, SSE stream, stop, chart memory
- ✅ **UX Wave F BE P0** บน branch `be/ux-wave-f` — phased SSE, `answerMode`, `summaryLine`/`followUps`
- ✅ tests ครอบ thread-service, message-service, reading, follow-up-suggestions

## งานที่เพิ่งทำเสร็จ (Recently Completed) — UX Wave F BE
- SSE `{ type:"status", phase:"chart"|"memory"|"writing" }` จาก `runReading` → messages route
- Body `answerMode: brief|detailed` — ลด `maxOutputTokens` + hint ใน system prompt
- `follow-up-suggestions.ts` — Flash-Lite สร้าง `summaryLine` + `followUps` (ไม่หักเครดิต)
- SSE `done` เพิ่ม `summaryLine`, `followUps`, `creditCost` (top-level)
- Heartbeat SSE เปลี่ยนเป็น `{ type:"ping" }`

## งานที่เสร็จก่อนหน้า
- `POST /api/conversations/:id/messages` — SSE หรือ legacy 202 + `after()`
- `POST /api/conversations/:id/stop` · `GET /api/conversations/:id/poll`
- Edit / regenerate · chart memory ใน prompt

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีบันทึกใหม่ในรอบ UX Wave F BE

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- P1: `balanceAfter` ใน `done` · feedback API (thumbs)
- Message pagination เธรดยาว (cap 200)
- Transit chart cache บน conversation (BE-E2.2)
- FE ยังไม่ parse `phase` / chips — รอ `UX_WAVE_F_FE.md`

## Checklist งานต่อไป (Next Steps)
- [x] UX-BE-F1.1–F1.3
- [ ] UX-BE-F2.1–F2.2 (P1)
- [ ] Merge `be/ux-wave-f` → `main` หลัง FE พร้อม
- [ ] Wave 4: message cursor pagination
