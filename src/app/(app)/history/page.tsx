import { ScaffoldNote } from "@/components/scaffold-note";

export default function HistoryPage() {
  return (
    <ScaffoldNote title="ประวัติการดูดวง" owner="Both">
      รายการคำอ่านย้อนหลัง + กรองตามหมวด + เปิดดูฉบับเต็ม. ข้อมูลเป็นของผู้ใช้เท่านั้น
      (<code className="mx-1">GET /api/me/history</code>).
    </ScaffoldNote>
  );
}
