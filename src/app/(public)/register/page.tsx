import { ScaffoldNote } from "@/components/scaffold-note";

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center">
      <ScaffoldNote title="สมัครสมาชิก" owner="Frontend">
        ฟอร์ม ชื่อ/อีเมล/รหัสผ่าน + ยอมรับเงื่อนไข. ส่งไปที่
        <code className="mx-1">POST /api/auth/register</code> (Backend task).
      </ScaffoldNote>
    </main>
  );
}
