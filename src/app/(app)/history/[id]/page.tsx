import { ScaffoldNote } from "@/components/scaffold-note";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ScaffoldNote title="รายละเอียดคำอ่าน" owner="Both">
      แสดงคำอ่านฉบับเต็มของ reading id: <code className="mx-1">{id}</code>{" "}
      (<code className="mx-1">GET /api/me/history/:id</code>). ตรวจ ownership.
    </ScaffoldNote>
  );
}
