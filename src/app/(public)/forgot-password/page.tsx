import { ScaffoldNote } from "@/components/scaffold-note";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center">
      <ScaffoldNote title="ลืมรหัสผ่าน" owner="Both">
        ฟอร์มขอรีเซ็ตรหัสผ่าน → <code className="mx-1">POST /api/auth/forgot-password</code>.
        (ต้องยืนยันกับลูกค้าว่าจะส่งอีเมลจริงใน Phase 1 หรือไม่)
      </ScaffoldNote>
    </main>
  );
}
