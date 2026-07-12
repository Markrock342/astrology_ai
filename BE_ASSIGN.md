# 🟩 Backend — สถานะปิด M4 (อัปเดต 12 ก.ค. 2026)

**สถานะ:** โค้ด M4 ครบบน `main` · เหลือ manual go-live เท่านั้น

อ่านคู่กับ `M4_HANDOFF.md` · `BACKEND_TASKS.md` · `docs/backend_m4_deploy.md`

## ปิดแล้ว
- [x] Thread API + multi-turn (B1)
- [x] Tests credit/lock/idempotency/payment/rate-limit (B2)
- [x] Upstash rate-limit + in-memory fallback (B3)
- [x] Deploy docs + smoke/scripts (B4)
- [x] Engine scrape-first + transit create fields
- [x] Empty TRANSIT thread โหลดได้ (ก่อนข้อความแรก)
- [x] Admin AI CMS: prompts/persona + knowledge + ai-configs (inject เข้าแชท)

## ค้างมือ (ไม่ใช่โค้ด)
- [ ] Manual smoke production (รวมแก้บุคลิก/ความรู้แล้วถามแชท)
- [ ] Google OAuth redirect URI ตรงโดเมนจริง
- [ ] (Optional) `UPSTASH_*` บน Vercel

---

# 🚀 Wave E — Production Hardening (Backend)

ที่มา: production-readiness audit (12 ก.ค. 2026) · คะแนนรวม 5/10 · credit ledger 7/10 (แข็งแรง) · money loop 4/10 + deploy 3/10 (ต้องแก้)
อ่านคู่กับ `FE_ASSIGN.md` Wave E — งานที่มี 🔗 คือของที่ FE รออยู่ ต้องคุย contract ก่อน
**กติกา:** schema change รันผ่าน `npm run db:migrate` (อย่า `db push` บน main) · เขียน test คู่ทุกงาน P0/P1 · commit ทีละ ID

## 🔴 E0 — ต้องเสร็จก่อนเปิดรับเงินจริง

### BE-E0.1 · [P0] ปิดรหัส SUPER_ADMIN ดีฟอลต์ที่หลุดขึ้น repo
~~`admin@horasard.local / ChangeMe123!`~~ เคยหลุดใน `.env.example` + fallback ใน `seed.ts` — **ปิดแล้ว (12 ก.ค. 2026)**
- [x] **ด่วนสุด:** หมุนรหัสบน prod แล้ว (`scripts/rotate-admin-password.mjs`) — รหัส default ล็อกอินไม่ได้อีก
- [x] ลบ fallback `?? "ChangeMe123!"` ใน `seed.ts` → `throw` ถ้าไม่ตั้ง / อ่อน / เป็นค่าที่เคยเผยแพร่
- [x] ลบรหัสจริงจาก `.env.example` เหลือค่าว่าง
- [x] `sync-vercel-env.mjs` ใช้ allowlist — **ไม่ push `SEED_*` อีก**
- **เสร็จเมื่อ:** seed ล้มถ้าไม่ตั้งรหัส · ล็อกอินรหัสเดิมบน prod ไม่ได้ · **S** ✅

### BE-E0.2 · [P1] ปิด double-approve race (แจกเครดิตซ้ำ + subscription 2 อัน)
- [x] compare-and-swap ใน tx: `updateMany({ where:{ id, status:"PENDING" }})` → count===0 throw
- [x] partial unique index กัน PENDING ซ้ำต่อ user (`payments_userId_pending_unique`)
- [x] **test:** concurrent second approve loses CAS · **S** ✅

### BE-E0.3 · [P1] Email — blast radius กว้างกว่าที่คิด: **password reset ตายทั้งระบบ**
- [ ] (ops) verify domain Resend → ตั้ง `EMAIL_FROM` → `npm run deploy:env`
- [x] mailer.ts: production without Resend → `{ok:false}` (ไม่ fake-send) + warn sandbox FROM
- [x] password-reset: ลบ token ถ้าส่งอีเมลไม่สำเร็จ
- [ ] persist `notifiedAt`/`notifyError` บน `Payment` 🔗 (FE โชว์ badge) · **S** + ops

### BE-E0.4 · [P1] เปิด Upstash rate-limit จริง + auth fail-closed
- [ ] (ops) สร้าง Upstash → `UPSTASH_*` → deploy:env → redeploy
- [x] production ไม่มี Upstash → log CRITICAL (ยัง memory เพื่อไม่พัง login)
- [x] `/api/auth/login` **failClosed** เมื่อ Redis ล่ม · **S** + ops

### BE-E0.5 · [P1] Slip upload — rate limit + กัน storage abuse
- [x] `rateLimit(proof:user)` 5/min + 20/day · manual 5/min
- [x] gate proof ด้วย "ไม่มี PENDING payment"
- [ ] ลบ blob เมื่อ REJECTED ใน reviewPayment · **S**

### BE-E0.6 · [P1] Slip เป็น PII — private blob + validate path (PDPA)
- [ ] proof endpoint return **pathname** ไม่ใช่ public URL
- [ ] `submitPaymentSchema` → `proofPath` validate prefix
- [ ] blob → private + authenticated stream 🔗
- [ ] retention job · **M**

## 🟠 E1 — สัปดาห์แรก

### BE-E1.1 · [P1] Chart+profile หลุดจาก prompt หลัง 10 turns (ยังหักเงิน)
- [x] แนบ chart เข้ากับ **current userPrompt ทุกครั้ง** แทน pin ที่ history
- [x] test: long thread ยังมี `[natal]` ใน userPrompt · **S** ✅

### BE-E1.2 · [P1] Quota enforcement ให้ atomic (comment โกหกว่า atomic)
`quota-service.ts:53` — pre-check count นอก tx → ยิงพร้อมกันทะลุ cap
- [ ] re-run count **ใน** `$transaction` (reading-service.ts:210) ก่อน deductCredits, throw RATE_LIMITED เพื่อ rollback
- [ ] `SELECT ... FROM credit_wallets WHERE userId=$1 FOR UPDATE` ต้น tx (serialize ต่อ user)
- [ ] test: ยิง N พร้อมกัน dailyLimit=1 → SUCCESS 1 · **M**

### BE-E1.3 · [P1] 🔗 API ให้ user เห็น usage (คู่ FE-E1.1)
`/account` มีแค่ยอดเครดิต — limit fetch แล้วทิ้ง (`account-service.ts:76`)
- [ ] `GET /api/me/usage` → `{ balance, dailyLimit, monthlyLimit, usedToday, usedThisMonth }` (export+reuse `bangkokBoundaries`+counts จาก quota-service)
- [ ] + paginated history (CreditTransaction/reading)
- [ ] **คุย contract กับ FE ก่อน** (field names + pagination) · **M**

### BE-E1.4 · [P1] 🔗 ปิดทางตันซื้อซ้ำ (Pro เครดิตหมดซื้อไม่ได้)
- [ ] product credit-only top-up (reviewPayment เติมเครดิตไม่แตะ subscription)
- [ ] reviewPayment แยก branch: top-up vs package · 🔗 FE ทำฟอร์ม · **M**

### BE-E1.5 · [P2] แยก QUOTA_EXCEEDED จาก RATE_LIMITED
โควต้าหมดโชว์เป็น "ถามเร็วไป" + Retry ที่ไม่มีวันได้ผล
- [ ] throw `QUOTA_EXCEEDED` จาก quota-service — เก็บ `RATE_LIMITED` เฉพาะ rate-limit.ts · 🔗 FE-E1.4 · **S**

### BE-E1.6 · [P1] ⚖️ PDPA — เราสัญญาว่าลบข้อมูลได้ แต่ทำไม่ได้จริง
privacy policy + terms (`cms-keys.ts:184/186/258`) เขียนไว้ว่า *"ขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของคุณได้"* และ *"การลบบัญชีจะเป็นการลบข้อมูลถาวร"* — แต่ **ทั้ง codebase ไม่มี user deletion เลย** (`api/admin/users/[id]/route.ts` มีแต่ GET, ไม่มี DELETE route, ไม่มี self-serve delete) + สลิปเป็น public blob ถาวรที่ไม่มี path ลบ → ธุรกิจไทยที่อยู่ใต้ PDPA §33 ทำตามคำสัญญาตัวเองได้แค่ผ่าน `psql`
- [ ] `DELETE /api/me/account` (self-serve) — soft delete หรือ anonymize + ลบ slip blobs
- [ ] `DELETE /api/admin/users/[id]` (admin, requireSuperAdmin) + audit
- [ ] slip retention: ลบ blob N วันหลัง review (ต้องมี cron — ดู BE-E2.10) · **M**

## 🟡 E2 — เดือนแรก

### BE-E2.1 · [P2] ⭐ Payment.packageId FK — จุดคุ้มค่าสูงสุด
`amount` free-text + hardcode `"PRO"` + ไม่มี paper trail → "จ่าย 20 ได้ Pro" กันได้แค่สายตา
- [ ] เพิ่ม `packageId` FK บน `Payment` + `durationDays` บน `Package`
- [ ] reviewPayment derive จาก package row: creditQuota, price, `expiresAt=now+durationDays`
- [ ] payment ผูก package ตั้งแต่ submit 🔗 FE เลือก package · ปิดพร้อมกัน: self-grant/ใบเสร็จ/never-lapse · **M**

### BE-E2.2 · [P2] Transit chart cache บน Conversation
`reading-service.ts:148` — transit re-scrape myhora.com ทุกข้อความ (natal cache แล้ว)
- [ ] คำนวณครั้งเดียวตอน createConversation → persist ChartJson → reuse ทุก message · **S**

### BE-E2.3 · [P2] Subscription expiry + แยก reviewNote
⚠️ **อย่า over-scope:** read path **honor expiresAt อยู่แล้ว** (`account-service.ts:13/40`, `quota-service.ts:29` filter `OR:[{expiresAt:null},{expiresAt:{gt:now}}]`) → ไม่ต้องทำระบบ expiry/cron อะไรเลย บั๊กทั้งหมดคือ grant เขียน `expiresAt: null` **แก้บรรทัดเดียว**
- [ ] `expiresAt: addDays(now, pkg.durationDays??30)` ตอน grant (ต้องมี E2.1)
- [ ] แยก column: `note`=ของ user, เพิ่ม `reviewNote`=ของ admin (`payment-service.ts:145` ตอนนี้ทับ note user) 🔗 FE · **S**

### BE-E2.4 · [P2] Cost tracking (operator ตาบอดเรื่องเงิน cost=NULL)
`reading-service.ts:236` ไม่เคยเขียน estimatedCost
- [ ] field ราคา/1M token บน `AIProviderConfig` · คำนวณ estimatedCost ที่ 2 จุด logUsage · 🔗 FE โชว์ · **M**

### BE-E2.5 · [P2] Input token cap (KnowledgeDoc concat ไม่จำกัด = ค่า AI บาน)
`reading-service.ts:159` — ทุก doc enabled ต่อเข้า prompt ทุก call
- [ ] `maxInputChars` บน `AIProviderConfig` → truncate (ทิ้ง sortOrder ต่ำก่อน)
- [ ] ย้าย `MAX_CONVERSATION_TURNS` → `AIProviderConfig` · **M**

### BE-E2.6 · [P2] Model id validation (typo = ทุก request 502)
`admin-schemas.ts:285` `validateModel()` มีแต่ไม่ถูกเรียก
- [ ] เรียกใน createAIConfig/updateAIConfig เทียบ models-list + `?force=true` escape · **S**

### BE-E2.7 · [P2] AI config resolution deterministic + log ทุก attempt
- [ ] tie-break `router.ts:33` `orderBy:[{updatedAt:'desc'}]` (หรือ `priority Int`)
- [ ] log ทุก attempt: primary fail → AIUsageLog FAILED/TIMEOUT ก่อน fallback (`router.ts:85`)
- [ ] `test/route.ts`+health เรียก `generateOnce` ไม่ fallback (ตอนนี้ fallback สำเร็จโชว์ green หลอก) · **M**

### BE-E2.8 · [P2] Double-charge edge + ghost thread (BE ครึ่ง)
- [ ] ย้าย message write เข้า charging tx (`message-service.ts:94` → เรียกใน tx reading-service.ts:210)
- [ ] lazy conversation หรือ filter `thread-service.ts:68` `messages:{some:{}}` 🔗 FE · **M**

### BE-E2.9 · [P2] Security + ops baseline
- [ ] `requireSuperAdmin()` gate route เงิน/config (`rbac.ts:35` ตอนนี้ dead code): `/users/[id]/{credits,subscription}`, `/packages/**`, `/settings`, `/ai-configs/**`
- [ ] Admin role/status revalidate ใน jwt callback (`auth/config.ts:87`) — ตอนนี้ ban admin ไม่ได้จน token หมดอายุ
- [ ] Security headers `next.config.ts`: CSP `frame-ancestors 'none'`, nosniff, Referrer-Policy
- [ ] notification ใช้ `after()` แทน `void promise` (`payment-service.ts:57`)
- [ ] self-approval → audit action แยก `payment.approve.self` · **M**

### BE-E2.10 · [P2] ไม่มี cron/scheduled job เลยทั้งระบบ → ไม่มี safety net อะไรได้เลย
ไม่มี `vercel.json`, ไม่มี queue/worker → **ไม่มีอะไรที่รันตามเวลาได้เลย** ผลคือ: ลบสลิปตาม retention ไม่ได้ (PDPA), retry อีเมลที่ส่งไม่สำเร็จไม่ได้, payment ที่ค้าง PENDING ไม่มีใครมา reconcile (และ user ติดล็อกส่งสลิปใหม่ไม่ได้)
- [ ] สร้าง `vercel.json` + `crons` (บน Vercel เกือบฟรี)
- [ ] cron: slip retention sweep (คู่ BE-E1.6) · retry อีเมล fail · alert payment PENDING > 3 วัน · **M**

### BE-E2.11 · [P2] ไม่มีใบเสร็จ/ใบกำกับภาษีเลย — ทั้งที่รับเงินบาทจริง
grep `receipt|ใบเสร็จ|ใบกำกับ` ทั้ง `src/` = ไม่เจออะไรเลย → ลูกค้าจ่าย 199฿ ไม่ได้เอกสารอะไรกลับไป และคุณเองก็ไม่มีอะไรให้บัญชี paper trail มีแค่ `amount` free-text + `proofUrl` ที่แก้ได้
- [ ] ออก receipt artifact ตอน approve (ต้องมี BE-E2.1 `packageId` เป็นฐาน)
- [ ] admin export CSV payments สำหรับบัญชี/ภาษี · **M**

### BE-E2.12 · [P2] Admin publish ไม่ invalidate cache — แก้ CMS แล้วรอ 45-60 วิ
CMS caches ใช้ `unstable_cache({revalidate:45..60})` แบบ time-based ไม่มี tag (`settings-service.ts:182`, `category-service.ts:31`, `session-guard.ts:63`) และ **ทั้ง codebase ไม่มี `revalidateTag`/`revalidatePath` สักที่** → admin กด publish แล้วต้องรอถึงนาที และ push ทันทีไม่ได้
- [ ] เปลี่ยน cache เป็น tag-based → เรียก `revalidateTag()` ตอน publish ทุก entity (settings/faq/announcement/category/package)
- [ ] 🔗 FE: หน้า marketing เป็น `force-dynamic` ทั้งหมด (ยิง Postgres ทุก request) ควรเป็น static/ISR — ดู FE-E2.7 · **M**

## ⚪ E3 — ทีหลังได้
- [ ] Streaming (BE ครึ่ง): Gemini SSE/OpenAI stream → route ReadableStream, deduct ตอน stream จบ keyed Idempotency-Key 🔗 FE · **L**
- [ ] Chart engine authority: local formula เป็นหลัก, myhora scrape เป็น validation, alert เมื่อ fallback (`compute-chart.ts:52`) · **M**
- [ ] Observability: Sentry + CI (typecheck/lint/test) + migrate step · **M**
- [ ] [P3] เขียน `promptVersion` จริง (`reading-service.ts:223`) · **S**
- [ ] Admin tools: per-user throttle, payment reversal/refund, viewer readings/conversations · **L**

## ⚙️ Config/Ops (ทำครั้งเดียว ก่อนเปิด)
- [ ] `SEED_ADMIN_PASSWORD` (E0.1) · `EMAIL_FROM` + Resend domain (E0.3) · `UPSTASH_*` (E0.4)
- [ ] `VAPID_PUBLIC_KEY`+`_PRIVATE_KEY`+`_SUBJECT` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Web Push admin — ยังไม่ตั้ง push ไม่เข้ามือถือ)
- [ ] `npm run deploy:env` หลังตั้งครบ
