# UX Wave F — Postmortem: Chat Streaming Regressions & Fixes

> **สถานะ:** ✅ แก้ครบ · merge เข้า `main` แล้ว
> **Fix commit:** [`890e3a4`](https://github.com/Markrock342/astrology_ai/commit/890e3a4) — `fix(chat): resolve Wave F streaming regressions`
> **Regression มาจาก:** [`83d74af`](https://github.com/Markrock342/astrology_ai/commit/83d74af) (FE Wave F) + `8656477`/`cb22ae7`/`56fd24f` (BE Wave F)
> **Verified:** `tsc --noEmit` · 159 tests · `eslint` · `next build` ผ่านทั้งหมด
> **คู่กับ:** [UX_WAVE_F_BE.md](./UX_WAVE_F_BE.md) · [UX_WAVE_F_FE.md](./UX_WAVE_F_FE.md)

---

## TL;DR

หลัง merge UX Wave F แชทพังหนัก ผู้ใช้ให้ UX **1/10**:

1. **พิมแล้วแชทหาย** — ข้อความที่พิมกับ bubble ที่กำลังตอบหายไป
2. **เด้งขึ้นบนสุด** — พอส่ง view กระโดดไปข้อความเก่าสุดของเธรด
3. **สตรีมไม่ต่อเนื่อง** — ตัวอักษรมาเป็นชุด ๆ กระตุก ไม่ลื่นเหมือน ChatGPT
4. **คำตอบมาไม่ครบ** — ข้อความขาดหายตอนท้าย
5. **ค้างท้ายคำตอบ** — พิมพ์เสร็จแล้วแต่ caret/ปุ่ม/ชิปยังไม่โผล่อีกนาน

ต้นเหตุคือ **integration gap** — FE กับ BE ทำ Wave F แยกกันแล้วเอามาต่อ ทำให้ stream lifecycle ชนกันหลายจุด ไม่ใช่บั๊กเดียวแต่เป็น **14 บั๊กจริง** (ตรวจด้วย multi-agent review 7 มุม + adversarial verify · ตีตกข้อที่วิเคราะห์ผิด 11 ข้อ)

---

## Root cause หลัก (ทำไมถึงเกิดพร้อมกัน)

Wave F เพิ่ม 3 อย่างที่แตะ stream lifecycle พร้อมกัน โดยไม่ได้เทสต์ปลายทางร่วมกัน:

| ใคร | เพิ่มอะไร | ทำให้เกิด |
|-----|----------|-----------|
| FE `83d74af` | *"refactor stream accumulation & smooth typing to satisfy React Compiler purity"* | S2, S3, S5 — ใส่ `await rAF` ต่อ delta + animate ทุก bubble ตอน mount |
| BE `cb22ae7` | SSE `status` phases (chart/memory/writing) | ทำให้ watchdog นับ frame ไม่ครบ |
| BE `56fd24f` | `summaryLine`/`followUps` ผ่าน meta-call ตัวที่สอง | S5 — บล็อก `done` |
| BE `8656477` | `answerMode` brief/detailed + output token caps | S4 — cap ต่ำกว่าความยาวที่ prompt ขอ |

---

## บั๊กทั้งหมด + การแก้

### Frontend — `src/components/app/`

#### 1. [P0] Poll แย่ง state กับ SSE ที่กำลังสตรีม → แชทหาย (S1, S2)
`send()` ใส่ optimistic user message + `stream-<key>` PENDING placeholder **ก่อน** ยิง POST
placeholder ทำให้ `pendingAssistantIds` ไม่ว่าง → poll effect เด้งทำงานทันทีขณะ POST ยังค้างอยู่
ฝั่ง server `acceptMessage` ยังไม่ได้ insert PENDING row → `pollThreadForUser` คืน **list เก่าทั้งก้อน**
client `setMessages(poll.messages)` → ลบ bubble ที่เพิ่งพิม + placeholder ทิ้ง → delta/done หาที่ลงไม่เจอ

**แก้** ([chat-view.tsx](src/components/app/chat-view.tsx#L530)):
- poll bail ทันทีถ้า `inFlight` (มี SSE turn สด)
- ถ้า poll เข้ามากลางเทิร์นแต่ยังไม่เห็นว่า turn ของเรา settle → เก็บ optimistic ไว้ ไม่ทับ list
- เพิ่ม `inFlight` เข้า dep + `messagesRef` ให้ callback เทียบ list ปัจจุบันได้

#### 2. [P0] SmoothStreamMarkdown animate ทุก message ตอน mount → เด้งบน + retype (S2, S5)
component เดิม start จาก `shown=""` เสมอ แม้ข้อความจบแล้ว → bubble ยุบเหลือ 0 สูง scroll ดีดขึ้นบน แล้ว retype ประวัติทั้งเธรด

**แก้** ([smooth-stream-markdown.tsx](src/components/app/smooth-stream-markdown.tsx)):
- ข้อความที่ settle แล้ว (`streaming=false`) render เต็มทันที — init `shown` = content ไม่ใช่ ""
- animate เฉพาะ turn ที่กำลังสตรีมสด

#### 3. [P0] `await requestAnimationFrame` ต่อ delta → คอขวด + ค้างในแท็บพื้นหลัง (S3, S5, S1)
read loop เดิม `await new Promise(r => requestAnimationFrame(r))` ทุก delta → จำกัด ~60 delta/วิ
และ **rAF ไม่ยิงในแท็บที่ซ่อน** → loop ค้างสนิท `done` ไม่มา → watchdog มาร์คเทิร์นล้มทั้งที่ server สำเร็จ

**แก้** ([chat-view.tsx](src/components/app/chat-view.tsx#L974)):
- ลบ `await rAF` ออกจาก network loop — อ่านสตรีมรัวไม่บล็อก
- flush เข้า React แบบ coalesce (1 ครั้ง/เฟรม), แท็บซ่อนใช้ `setTimeout(80ms)`
- `turnSettled` flag กัน flush ที่ค้างอยู่ไม่ให้ทับ final state

#### 4. [P1] Stale-turn watchdog ไม่กิน status/ping frame → มาร์คเทิร์นสดล้มที่ 45 วิ
`lastDeltaAtRef` ถูกสแตมป์เฉพาะใน delta branch — `status` phase และ `ping` heartbeat (ทุก 1.5 วิ) ไม่นับ
คำตอบยาวที่ preamble > 45 วิ ก่อน delta แรก → โดน recover ทั้งที่ยังทำงานปกติ

**แก้** ([chat-view.tsx](src/components/app/chat-view.tsx#L1050)): สแตมป์ `lastDeltaAtRef` ทุก frame หลัง parse สำเร็จ

#### 5. [P1] Markdown re-parse ทุกเฟรมของทุก message
**แก้** ([chat-markdown.tsx](src/components/app/chat-markdown.tsx)): wrap `ChatMarkdown` + `SmoothStreamMarkdown` ด้วย `memo` — message ที่ settle แล้วไม่ re-parse ตอน turn อื่นสตรีม

### Backend — `src/server/`

#### 6. [P0] Gemini finishReason MAX_TOKENS ไม่ถูกอ่าน → คำตอบขาดเงียบ ๆ (S4)
brief cap 384/512 tokens แต่ prompt สั่ง ~300 คำ → ชน cap ตัดกลางประโยค แต่เก็บเป็น `SUCCESS` เฉย ๆ

**แก้** ([gemini.ts](src/server/ai/providers/gemini.ts)): อ่าน `finishReason` ทั้ง `generate()` + `streamGenerate()` → set `truncated` บน `GenerateAIResult` → [reading-service.ts](src/server/horoscope/reading-service.ts) ต่อท้ายหมายเหตุ *"พิมพ์ เล่าต่อ เพื่อฟังส่วนที่เหลือ"*

#### 7. [P0] Gemini stream timeout ทิ้ง partial ที่สตรีมมาแล้ว (S4)
timeout เดิมเป็น wall-clock แบน ๆ — คำตอบไทยยาวเกิน 30 วิ → abort แล้วทิ้งทุกอย่างที่สตรีมมา คืนเป็น error

**แก้** ([gemini.ts](src/server/ai/providers/gemini.ts)): เปลี่ยนเป็น **idle-timeout** (reset ทุก chunk) + ถ้า timeout ตอนมี text แล้ว → คืน `ok:true` + `truncated`

#### 8. [P1] meta-call บล็อก `done` → ค้างท้ายคำตอบถึง 15 วิ (S5)
`generateFollowUpMeta` (Flash-Lite) ถูก `await` ก่อนส่ง `done` → หลังพิมพ์เสร็จ caret/ปุ่ม/ชิปค้างรอ meta

**แก้** ([route.ts](src/app/api/conversations/[id]/messages/route.ts#L201) + [reading-service.ts](src/server/horoscope/reading-service.ts)):
- reading-service คืน `metaPromise` แทน `await` meta
- route ส่ง `done` ทันที แล้วยิง `{type:"meta"}` เป็น frame แยกทีหลัง
- client เพิ่ม handler `meta` แปะ summaryLine/followUps บนข้อความที่ settle แล้ว

#### 9. [P1] Provider fallback สตรีมคำตอบซ้ำ
ถ้า primary ล้มกลางสตรีมหลังส่ง text ไปแล้ว → fallback สตรีมคำตอบที่สองทับ onDelta เดิม → เห็นคำตอบซ้อนกัน

**แก้** ([router.ts](src/server/ai/router.ts)): นับ byte ที่ส่งไปแล้ว — ถ้า primary emit อะไรไปแล้วไม่ fallback

#### 10. [P1] brief cap ขัดกับ prompt hint (S4)
**แก้** ([constants.ts](src/config/constants.ts#L57)): ปรับ cap 384/512 → 640/768 (ยังต่ำกว่า detailed) + ลด hint เหลือ ~150 คำ ให้ตรงกัน · ขยาย SSE delta chunk 24 → 96 ตัว · meta cap 256 → 320, timeout 15s → 8s

---

## ที่จงใจ**ไม่**แก้ (มีเหตุผล — อย่าเผลอไปแก้)

| จุด | ทำไมปล่อยไว้ |
|-----|--------------|
| `FREE_MAX_OUTPUT_TOKENS = 1024` | ขยาย = กระทบต้นทุน/monetization เป็นการตัดสินใจ business · ตอนนี้ถ้าชน cap จะโชว์หมายเหตุ "ถูกตัด" แล้ว |
| `recoverStaleTurn` มาร์ค FAILED | watchdog ตอนนี้กิน ping ทุก 1.5 วิแล้ว จะไม่ false-positive · retry ใช้ idempotency key เดิม ไม่ชาร์จซ้ำ |
| brief mode sticky ใน localStorage | เป็น user preference ที่ตั้งใจ · brief ไม่ตัดกลางแล้วเลยไม่อันตราย |

---

## บทเรียน / กันซ้ำ

1. **FE/BE ที่แตะ stream lifecycle ต้องเทสต์ปลายทางร่วมกัน** — Wave F แต่ละคน P0 ผ่านของตัวเอง แต่ contract ตรงไม่พอ พฤติกรรมรวมพัง
2. **อย่า `await rAF`/`await` อะไรใน network read loop** — SmoothStreamMarkdown pace การโชว์อยู่แล้ว, reader ไม่ต้อง throttle เอง
3. **อย่าให้ background work (meta) บล็อก critical path (`done`)** — แยกเป็น SSE frame ทีหลัง
4. **cap ต้องสอดคล้องกับ prompt ที่ขอความยาว** — ตั้ง cap ต่ำกว่าที่ prompt สั่ง = ตัดกลางประโยคแน่นอน
5. **finishReason / partial ต้อง surface เสมอ** — การตัดเงียบ ๆ แล้วเก็บ SUCCESS คือ data loss ที่ผู้ใช้จับได้

---

## ทดสอบ manual ที่ควรทำก่อนแตะ chat ครั้งหน้า

- [ ] ส่งคำถามใหม่ในเธรดว่าง → user bubble + คำตอบสตรีมต่อเนื่อง ไม่หาย ไม่เด้งบน
- [ ] คำตอบยาว (detailed) → สตรีมลื่นถึงจบ ไม่ตัดกลาง
- [ ] สลับไปแท็บอื่นระหว่างตอบ แล้วกลับมา → คำตอบครบ ไม่ค้าง
- [ ] brief mode → คำตอบสั้นจบสวย ไม่มีหมายเหตุ "ถูกตัด"
- [ ] พิมพ์เสร็จ → ชิป follow-up โผล่ตามมาไว ไม่ค้าง
- [ ] กด Stop กลางคัน → เก็บ partial, ไม่ชาร์จถ้ายังไม่มีคำตอบ
