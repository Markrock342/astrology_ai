# Backend — Performance (Wave Perf)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **Wave 1** — chat poll เบา, bootstrap light, usage summary, indexes
- ✅ **Wave 2** — admin CMS summary APIs, lazy editor load, revision/diff on demand
- ✅ **Wave 3 (pool + resilience)** — แก้ connection pool timeout, natal chart ไม่บล็อก DB, bootstrap cache

## งานที่เพิ่งทำเสร็จ (Recently Completed) — Wave 3

### สาเหตุหลักของ "Something went wrong" / โหลดช้า
- `db.ts` บังคับ `connection_limit=1` — warm Vercel instance รับหลาย request พร้อมกัน (layout bootstrap + chat poll + natal compute) แล้วแย่ง connection จน timeout 10s
- `queueNatalChart()` คำนวณพื้นดวง (scrape myhora 10–60s) แล้วค่อย `natalChart.update()` — ช่วงรอ connection ถูก request อื่นจองหมด

### การแก้ไข
- **`src/server/db.ts`** — `connection_limit` ค่าเริ่ม 5 (prod) / 3 (dev), `pool_timeout=20`, auto `pgbouncer=true` เมื่อใช้ Supabase pooler (`:6543`)
- **`src/server/prisma-utils.ts`** — `withPrismaRetry()` สำหรับ pool timeout ชั่วคราว
- **`natal-chart-service.ts`** — mark PENDING แล้ว `after()` คำนวณพื้นดวงนอก request (ไม่ถือ connection ระหว่าง scrape)
- **`bootstrap-service.ts`** — `Promise.allSettled` (partial fail ไม่พังทั้ง shell), `getCachedAppBootstrap` cache 15s, announcements cache 60s
- **`bootstrap-cache.ts`** — `invalidateUserBootstrap` หลังสร้าง/ลบเธรด
- **`http.ts` + `chat-view.tsx`** — ข้อความภาษาไทยแทน "Something went wrong"
- **`landing-manager.tsx`** — normalize CMS draft (กัน `.map` บน `undefined` → error boundary แท็บ Hero/จุดเด่น/ฯลฯ)
- **`admin/landing/page.tsx`** — soft-fail โหลด settings ไม่ได้ → ใช้ CMS defaults

### User (Wave 1 recap)
- `GET /api/conversations/:id/poll` — poll แค่ `COUNT(PENDING)` ขณะ AI ทำงาน
- `GET /api/app/bootstrap?scope=light` — refresh หลังแชท
- Bootstrap ใส่ `natalChartStatus` — banner ไม่เรียก natal-chart จน READY
- Thread list cap 30 รายการ

### Admin (Wave 2 recap)
- Summary list APIs + lazy editor load
- Dashboard cache 60s · audit entityTypes cache

### Database
- Migration `20260712200000_perf_indexes`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- **Local dev API 404 ทั้งก้อน / UI หลอกว่าเป็น Free:** หยุด node ซ้อน → ลบ `.next` → `npx prisma generate` (ก่อน start dev บน Windows กัน EPERM) → `npm run dev` → logout/login ใหม่; ยืนยันด้วย `npm run smoke:app`
- **Prisma pool timeout (`natalChart.update`, limit 1):** เพิ่ม connection limit + แยก natal compute ด้วย `after()` + retry
- **Admin landing แท็บ crash:** CMS JSON จาก DB ไม่มี `items`/`steps` → `value.items.map` throw → แก้ด้วย `asFeatures`/`asHow` normalize
- **Dev mode:** Turbopack + `force-dynamic` ช้ากว่า prod — วัดบน Vercel หลัง deploy

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- `GET /api/conversations/:id` ยังไม่ paginate ข้อความยาวมาก (cap 200)
- `(app)/layout` ยัง `force-dynamic` แต่ bootstrap cache 15s ลด DB round-trip ระหว่างสลับหน้า
- Vercel cold start + Supabase latency — ตั้ง `PRISMA_CONNECTION_LIMIT` ใน env ถ้ายัง timeout

## Checklist งานต่อไป (Next Steps)
- [x] Deploy Wave 3 บน `main` (pool fix + indexes migration)
- [ ] ตั้ง `PRISMA_CONNECTION_LIMIT=5` บน Vercel ถ้ายัง timeout
- [ ] Wave 4: message cursor pagination
- [ ] วัด TTFB / Web Vitals หลัง deploy
