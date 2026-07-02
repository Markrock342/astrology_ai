import { ScaffoldNote } from "@/components/scaffold-note";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ScaffoldNote title="Admin · รายละเอียดผู้ใช้" owner="Both">
      user id: <code className="mx-1">{id}</code> — โปรไฟล์ + birth profile +
      แพ็กเกจ/สถานะ + เครดิต + ประวัติ + usage logs + ปุ่มปรับสิทธิ์.
    </ScaffoldNote>
  );
}
