import { ScaffoldNote } from "@/components/scaffold-note";

export default function DashboardPage() {
  return (
    <ScaffoldNote title="แดชบอร์ดผู้ใช้" owner="Both">
      แสดง: แพ็กเกจปัจจุบัน · เครดิต/สิทธิ์คงเหลือ · หมวดหมู่ (ล็อก Pro) ·
      ประวัติล่าสุด · ปุ่มอัปเกรด. Backend ให้ข้อมูลผ่าน
      <code className="mx-1">/api/me</code>, <code className="mx-1">/api/me/credits</code>,
      <code className="mx-1">/api/horoscope/categories</code>.
    </ScaffoldNote>
  );
}
