import { ScaffoldNote } from "@/components/scaffold-note";

export default function AdminDashboardPage() {
  return (
    <ScaffoldNote title="Admin · ภาพรวม" owner="Both">
      สรุป: ผู้ใช้ทั้งหมด/Free/Pro · คำขอ AI วันนี้/เดือนนี้ · เครดิตที่ใช้ ·
      สำเร็จ/ล้มเหลว · ต้นทุน AI โดยประมาณ · การชำระเงินล่าสุด · error ล่าสุด.
    </ScaffoldNote>
  );
}
