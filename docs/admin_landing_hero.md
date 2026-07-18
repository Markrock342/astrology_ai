# Admin Landing Hero — พื้นหลังรูป/วิดีโอจาก CMS

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- แอดมินเปลี่ยนพื้นหลัง hero เต็มจอได้ที่ `/admin/landing` แท็บ Hero
- รองรับ `none` (ไล่สี) · `image` (อัปโหลดหรือ URL) · `video` (URL ไฟล์ mp4/webm เท่านั้น)
- มีปุ่ม «ใส่ตัวอย่างธีม» → `/samples/landing-hero-bg.jpg` + overlay 55%
- ดูตัวอย่าง: «ดูตัวอย่าง ↗» หรือ «ดูในแท็บนี้» (เปิด cookie preview — ไม่ถูกเด้งแชทตอนล็อกอิน)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Helpers: `src/lib/landing-hero-bg.ts` (`resolveHeroBackground`, ตรวจ YouTube/ไฟล์วิดีโอ)
- Zod: บังคับ URL เมื่อเลือก image/video · ปฏิเสธ YouTube/Vimeo
- Admin UX: คำอธิบาย draft→preview→publish, พรีวิวย่อ, ปุ่มตัวอย่างธีม, hint วิดีโอชัด
- Toolbar: ปุ่ม «ดูในแท็บนี้» กัน popup blocker
- Publish landing → `revalidatePath("/")` ลดอาการ ISR ค้าง
- Tests: `tests/landing-hero-bg.test.ts` + ขยาย `tests/cms-landing-schemas.test.ts`
- Asset: `public/samples/landing-hero-bg.jpg`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: เพื่อนทำ wire แล้วแต่ “ใช้ไม่ได้”
- [วิธีที่ลองแก้ไปแล้ว]: สาเหตุหลักคือ (1) ล็อกอินแล้วเปิด `/` ตรง ๆ ถูก redirect (2) บันทึกแค่แบบร่างไม่ publish (3) วิดีโอใส่ YouTube / คิดว่าอัปโหลด `/api/media` ได้ (4) เลือก type แต่ URL ว่าง → เงียบกลับไปไล่สี — แก้ด้วย hint + validation + ตัวอย่างธีม + ดูในแท็บนี้

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ยังไม่อัปโหลดไฟล์วิดีโอเข้า `media_assets` (Postgres ไม่เหมาะกับไฟล์ใหญ่) — ใช้ URL ไฟล์ภายนอก
- ไม่รองรับ YouTube/Vimeo embed เป็นพื้นหลัง `<video>`
- Soft-nav dashboard ยังอยู่ branch แยก

## Checklist งานต่อไป (Next Steps)
- [ ] (ถ้าลูกค้าต้องการ) อัปโหลดวิดีโอผ่าน object storage
- [x] ทำให้ image/video background ใช้ได้จริงจาก Admin
- [x] ตัวอย่างธีม + เอกสารวิธีใช้
- [x] เทส unit/schema

## วิธีใช้สั้น ๆ สำหรับแอดมิน
1. ไป `/admin/landing` → แท็บ Hero
2. เลือกชนิดพื้นหลัง หรือกด «ใส่ตัวอย่างธีม»
3. **บันทึกแบบร่าง** → **ดูตัวอย่าง** / **ดูในแท็บนี้**
4. พอใจแล้วกด **เผยแพร่** — ผู้เยี่ยมชมทั่วไปถึงจะเห็น
