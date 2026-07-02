import { ScaffoldNote } from "@/components/scaffold-note";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center">
      <ScaffoldNote title="เข้าสู่ระบบ" owner="Frontend">
        ฟอร์ม email/password + ลืมรหัสผ่าน + ปุ่ม Google (ถ้าเปิดใช้). เรียก
        <code className="mx-1">signIn</code> จาก NextAuth. Backend มี
        <code className="mx-1">/api/auth/[...nextauth]</code> พร้อมแล้ว.
      </ScaffoldNote>
    </main>
  );
}
