"use client";

import { AdminPage, EmptyPanel, PageHeader } from "./ui";

export function UsagePanel() {
  return (
    <AdminPage>
      <PageHeader
        title="Usage / AI Logs"
        description="ประวัติการเรียก AI · token · latency · สถานะสำเร็จ/ล้มเหลว"
      />
      <EmptyPanel
        title="รอเปิดใช้ AI (M3)"
        description="เมื่อ `NEXT_PUBLIC_APP_PHASE=3` และ Gemini ทำงานจริง หน้านี้จะแสดงตาราง usage logs พร้อมกรองตามวันที่ / ผู้ใช้ / สถานะ"
      />
    </AdminPage>
  );
}
