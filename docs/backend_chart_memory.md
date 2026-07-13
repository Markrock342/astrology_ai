# Backend — Chart memory + token optimization

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **บน `main`** — `UserChartMemory` persist จาก natal chart, inject `[memory]` ใน prompt แบบเลือกหมวด, ลดโทเคน follow-up
- ✅ เทิร์นแรกส่ง `[natal]` เต็ม · เทิร์นถัดไปส่งแบบย่อ + memory เฉพาะหมวดที่เกี่ยว
- ✅ สรุปลูกค้า: [TOKEN_COST_OPTIMIZATION_CLIENT_SUMMARY.md](./TOKEN_COST_OPTIMIZATION_CLIENT_SUMMARY.md)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Migration `20260712230000_user_chart_memory_daily_transit` — `user_chart_memory`, `daily_transit` tables
- `derive-chart-memory.ts` — สรุปเรือน/ดาว/เจ้าเรือนจาก `ChartJson`
- `chart-memory-service.ts` — `upsertChartMemory`, `getOrRefreshChartMemory` (re-derive เมื่อ birth hash เปลี่ยน)
- `natal-chart-service.ts` — อัปเดต memory หลัง chart READY
- `reading-service.ts` + `prompt-builder.ts` — จำกัด history 4 รอบ, truncate assistant 600 ตัวอักษร, knowledge cap 4k chars
- `daily-transit-service.ts` — scaffold ดวงจรรายวัน (ยังไม่ auto ทุกวัน)
- Tests: `chart-memory.test.ts`, `horasard-standard-v1.test.ts`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: แชทขึ้น "ระบบทำนายขัดข้องชั่วคราว" + `Cannot read properties of undefined (reading 'findUnique')`
  - [สาเหตุ]: dev server เริ่มก่อน `prisma generate` สำเร็จ → Prisma client เก่าไม่มี delegate `userChartMemory` (Wave E chart memory)
  - [วิธีแก้]: `getOrRefreshChartMemory` fallback เป็น `deriveChartMemory` in-memory; `daily-transit-service` ข้าม cache เมื่อ model หาย; log ชัดใน `db.ts` — หลัง pull/run migrate ให้ `npx prisma generate` + restart dev server
- ไม่มีบันทึกอื่นในโมดูลนี้

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Transit chart cache บน `Conversation` (BE-E2.2) — ยัง recompute บาง path
- `answerMode` brief/detailed (UX Wave F) — ยังไม่มี

## Checklist งานต่อไป (Next Steps)
- [ ] UX Wave F: `summaryLine` + `followUps` จาก Flash-Lite (ไม่หักเครดิต user)
- [ ] BE-E2.2 transit cache บน conversation
- [ ] วัดโทเคน/ต้นทุนจริงหลัง deploy บน prod
