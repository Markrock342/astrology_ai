import { ScaffoldNote } from "@/components/scaffold-note";

export default function OnboardingPage() {
  return (
    <ScaffoldNote title="กรอกข้อมูลวันเกิด" owner="Both">
      ฟอร์ม birth profile (ชื่อเล่น, วันเกิด, เวลาเกิด, เพศ, สถานที่เกิด, หมายเหตุ)
      พร้อม validation. บันทึกผ่าน <code className="mx-1">PUT /api/me/birth-profile</code>.
    </ScaffoldNote>
  );
}
