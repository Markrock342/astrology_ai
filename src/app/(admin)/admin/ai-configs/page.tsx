import { ScaffoldNote } from "@/components/scaffold-note";

export default function AdminAiConfigsPage() {
  return (
    <ScaffoldNote title="Admin · AI Models" owner="Both">
      ลงทะเบียน provider/model · เปิด-ปิด · temperature · maxOutputTokens ·
      timeout · fallback · planScope · assign category/prompt · ปุ่ม Test.
      API key อยู่ใน env เท่านั้น — DB เก็บแค่ชื่อ secret (secretReference).
    </ScaffoldNote>
  );
}
