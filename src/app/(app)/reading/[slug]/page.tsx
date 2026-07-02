import { ScaffoldNote } from "@/components/scaffold-note";

export default async function ReadingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <ScaffoldNote title={`หน้าดูดวง — หมวด: ${slug}`} owner="Both">
      Flow ตาม spec 5.6. ต้องรองรับ state: loading · AI processing · success ·
      no quota · locked · timeout · provider error · retry (ห้ามหักเครดิตซ้ำ).
      เรียก <code className="mx-1">POST /api/horoscope/readings</code> พร้อม header
      <code className="mx-1">Idempotency-Key</code>.
    </ScaffoldNote>
  );
}
