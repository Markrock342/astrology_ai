# Frontend — App UI ตาม Horasard mockups

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **UI หลักครบบน `main` @ `981010d`** — auth, onboarding, chat แบบ ChatGPT-style, account/usage, payment, admin CMS
- ✅ F1–F4 + Wave D + UX polish (edit/regenerate, multiline composer, SSE stream, stop, markdown)
- 🟡 **UX Wave F P0** — ยังไม่ครบ (3-phase thinking, follow-up chips, summary callout) → [UX_WAVE_F_FE.md](../UX_WAVE_F_FE.md)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- **Chat bug verification (audit)** — ยืนยันงานแก้แชทรอบ 1–3 อยู่ครบใน `chat-view.tsx` + `chat-sse-*.ts` + `chat-turn-guard.ts` + `messages/route.ts`; `npm test` 191/191 ผ่าน; static trace 8 scenario ผ่านทุกข้อ; เหลือ live-browser confirm เฉพาะ timing scenario (phase 60–90s ไม่แดงก่อน 120s, follow-up Q2, refresh กลาง stream)
- **Chat realtime / false stale fix** — `chat-sse-activity.ts`: sliding SSE idle 120s, รับ `ping`/`status` เป็น activity; `STALE_TURN_MS` 120s; `ThinkingIndicator` แสดง phase chart/memory/writing; poll merge partial stream; `sendBlocked` ปิดปุ่มส่งขณะรอ; test `tests/chat-sse-activity.test.ts`
- **Follow-up send stack fix** — `activeTurnRef` + `streamGenerationRef` serialize turn; optimistic user หลัง busy guard; `shouldBlockFollowUpSend` รวม pending assistant; `isStreamingTurn` ผูก `activeAssistantId`; test `tests/chat-turn-guard.test.ts`
- **Chat stream loop fix** — รวม SSE delta ต่อ network chunk + `streamPhaseRef` กัน "Maximum update depth exceeded" (`setState("streaming")` ครั้งเดียวต่อ chunk นอก inner delta loop); optimistic user bubble วาง**หลัง** busy guard (แก้ต่อในรอบ follow-up); ข้อความเตือนเมื่อส่งซ้ำระหว่างรอ; retry ล้าง error/stale `stopTarget`; test `tests/chat-sse-batch.test.ts`
- **Dashboard cascade fix** — SSR `getCachedAppBootstrap` ใน `(app)/layout.tsx`, `session-guard-client.ts` sign-out เมื่อ session stale, `SidebarNavSkeleton`, JWT revalidate 60s
- **Fix soft-nav / sidebar dead** — `useChatRouteSearchParams`, test `tests/chat-route-search.test.ts`
- `chat-view.tsx` — SSE streaming, แก้ไขข้อความ user, regenerate assistant, stop generation, `ThinkingIndicator`, `thread-cache` client
- `chat-markdown.tsx` / `smooth-stream-markdown.tsx` — render markdown + stream
- `message-actions.tsx` — copy / regenerate / edit
- `chat-usage-bar.tsx` + `usage-summary.tsx` — แสดงเครดิต + โควต้าวันนี้จาก `GET /api/me/usage?view=summary`
- `app-shell.tsx` — client thread cache, prefetch nav, pending payment banner
- `payment-submit-card.tsx` — ส่งแค่ยอด + สลิป (ไม่มีเลขอ้างอิง)
- Admin: provider alert banner, lazy CMS editors (prompts/knowledge/faq)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Dashboard แสดง Free / เครดิต 0 / "โหลดข้อมูลไม่สำเร็จ" ทั้งที่ login admin อยู่
  - [สาเหตุ]: `AppDataProvider` โหลด bootstrap ฝั่ง client เท่านั้น (`initialData=null`) — เมื่อ API ล้ม (dev Turbopack 404 / session stale) UI ใช้ mock `NATAL_CATEGORIES` ดูเหมือน Free
  - [วิธีแก้]: SSR bootstrap ใน layout + sign-out อัตโนมัติเมื่อ `UNAUTHENTICATED`/`NOT_FOUND` + skeleton แทน mock categories
- [ปัญหา]: แชทตอบ "ระบบทำนายขัดข้องชั่วคราว" + `Cannot read properties of undefined (reading 'findUnique')`
  - [สาเหตุ]: Prisma client เก่าไม่มี model `userChartMemory` — ดู [backend_chart_memory.md](./backend_chart_memory.md)
  - [วิธีแก้]: fallback derive in-memory ใน `chart-memory-service.ts`; รัน `npx prisma generate` แล้ว restart dev server
- [ปัญหา]: กดเมนู sidebar (หมวด / ประวัติ / ดวงจร) แล้วหน้าไม่เปลี่ยน + ส่งข้อความได้แต่ขึ้น "เลือกหมวดจากแถบข้างก่อนเริ่มดูดวง"
  - [สาเหตุ]: `chat-nav` ใช้ `history.pushState` (soft nav) แต่ `useSearchParams()` ของ Next.js 16 **ไม่ sync** กับ native history → `cat` / `thread` ใน React ค้างเป็น `null`
  - [วิธีแก้]: เพิ่ม `useChatRouteSearchParams()` ใน `chat-nav.ts` อ่าน `window.location` + listen `horasard:soft-nav` — ใช้ใน `chat-view.tsx` และ `app-shell.tsx`
- [ปัญหา]: Prisma pool timeout → ข้อความ "Something went wrong" ในแชท
  - [วิธีที่ลองแก้]: แก้ฝั่ง BE (pool limit, natal `after()`) + localize error เป็นภาษาไทยใน `chat-view.tsx` — ดู [backend_performance.md](./backend_performance.md)
- [ปัญหา]: Composer disabled บนหมวด Pro-locked
  - [วิธีที่ลองแก้]: แก้ใน `chat-view.tsx` + `access-policy` ฝั่ง BE
- [ปัญหา]: ส่งข้อความแล้ว user bubble ไม่ขึ้นทันที / ส่งซ้ำระหว่างรอ AI แล้วเงียบ / error banner ค้างกด retry ไม่ได้ / crash `Maximum update depth exceeded` ที่ `setState("streaming")`
  - [สาเหตุ]: หลาย SSE `delta` ใน `reader.read()` เดียว → `setState`+`setMessages` ซ้ำใน tick เดียว; `send()` return ก่อน optimistic user; `stopTarget` จาก assistant `PENDING` ค้างบล็อก retry แม้ `state === "error"`
  - [วิธีแก้]: batch delta ต่อ chunk + `streamPhaseRef`; `sendBlockedHint`; busy guard = `shouldBlockFollowUpSend` (เช็ก `activeTurn` + `pendingAssistant` + `inFlight`); `retryPendingSend` ล้าง FAILED; helper `src/lib/chat-sse-batch.ts`
- [ปัญหา]: ถามต่อในเธรดเดิม — คำถาม 1 เงียบ คำถาม 2 แล้วคำตอบ Q1 ค่อยโผล่ / user bubble สะสม
  - [สาเหตุ]: optimistic user ก่อน busy guard; `inFlight` ตั้งช้าหลัง `await`; `isStreamingTurn` ใช้ index สุดท้าย; stale cleanup ลบ placeholder Q1
  - [วิธีแก้]: `activeTurnRef` + `streamGenerationRef` ใน `src/lib/chat-turn-guard.ts`; optimistic user หลัง guard; `resolveActiveAssistantId` สำหรับ thinking/stream UI
- [ปัญหา]: แชทไม่เรียลไทม์ / ขึ้นแดง "ใช้เวลานานผิดปกติ" ภายใน ~45s ทั้งที่ server ยังส่ง ping/status
  - [สาเหตุ]: `STALE_TURN_MS=45s` + `FETCH_STREAM_TIMEOUT=35s` นับเฉพาะ delta; ช่วง chart/memory ก่อน delta แรกไม่ถูกนับเป็น activity
  - [วิธีแก้]: `src/lib/chat-sse-activity.ts` — sliding idle 120s, `shouldRecoverStaleTurn`, parse SSE `status` phase, poll `mergePollMessages`

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- UX-FE-F1.1–F1.4 (Wave F P0) — รอ SSE contract จาก BE
- FE-E1.1 บางส่วน: usage history เต็มใน account ยังไม่ครบทุก field
- FE-E1.2 REJECTED reason จาก `reviewNote` — รอ BE-E2.3
- Legal content จริงใน CMS (หน้า scaffold มีแล้ว)

## Checklist งานต่อไป (Next Steps)
- [ ] UX Wave F P0 ตาม `UX_WAVE_F_FE.md`
- [ ] FE-E1.2 rejected payment UX
- [ ] Smoke มือ: Pro แชท + ดวงจร + ประวัติหลัง refresh
