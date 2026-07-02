import { ScaffoldNote } from "@/components/scaffold-note";

export default function AdminUsersPage() {
  return (
    <ScaffoldNote title="Admin · ผู้ใช้" owner="Both">
      ค้นหา/ดูผู้ใช้ · เปิด-ปิดใช้งาน · ตั้ง Free/Pro · วันหมดอายุ ·
      เพิ่ม/หักเครดิต · ดูประวัติ/usage · โน้ตแอดมิน. ทุกการเปลี่ยนแปลงลง audit log.
    </ScaffoldNote>
  );
}
