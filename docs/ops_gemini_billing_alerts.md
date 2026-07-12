# Gemini / Google AI — กันเงินหมดแล้วระบบพังเงียบ

API key **ดึงยอด Prepay คงเหลือจาก Google ไม่ได้** ต้องตั้งเตือนฝั่ง Google + ใช้ระบบแจ้งเตือนในแอป

## 1) ต้องทำใน Google (สำคัญที่สุด)

1. เปิด [AI Studio Billing / Plans](https://aistudio.google.com/plans) — ดูยอด Prepay
2. เปิด [Cloud Billing → Budgets & alerts](https://console.cloud.google.com/billing)  
   - สร้าง Budget สำหรับโปรเจกต์ที่ผูก Gemini  
   - ตั้งแจ้งเตือนที่ **50% / 90% / 100%** ส่งอีเมลคุณ  
3. เติมเงินก่อนยอดใกล้หมด — อย่ารอจนแชทตาย

## 2) สิ่งที่แอปทำให้อัตโนมัติแล้ว

เมื่อ Gemini ตอบ error แบบ billing / quota / key:

- เขียน `AIUsageLog` + log `[CRITICAL][AI_BILLING|QUOTA|KEY]` ใน Vercel logs
- โชว์ **แถบแดงในทุกหน้า /admin** (poll ทุก 1 นาที จาก failure ใน 6 ชม.ล่าสุด)
- หน้า `/admin/ai-configs` แสดงกล่องเตือนเดียวกัน
- ลูกค้าได้ข้อความไทยชัดว่าอาจหมดเครดิต Gemini (ไม่หักเครดิตในแอป)

## 3) ตรวจเร็วเมื่อสงสัย

```bash
# ใน Vercel logs ค้นหา
[CRITICAL][AI_BILLING]
```

หรือเข้า `/admin` — ถ้ามีแบนเนอร์แดง = ต้องเติมเงิน/แก้โควต้าทันที
