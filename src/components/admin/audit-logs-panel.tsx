"use client";

import { AdminPage, EmptyPanel, PageHeader } from "./ui";

export function AuditLogsPanel() {
  return (
    <AdminPage>
      <PageHeader
        title="Audit Logs"
        description="บันทึกการกระทำของแอดมิน — ทุก mutation ในระบบจัดการผู้ใช้/หมวด/แพ็กเกจ"
      />
      <EmptyPanel
        title="ยังไม่มี API แสดงผล"
        description="ระบบเขียน audit log ลง DB แล้วทุกครั้งที่แอดมินเปลี่ยนข้อมูล — หน้านี้จะแสดงตารางค้นหาเมื่อเพิ่ม `GET /api/admin/audit-logs` ใน M3"
      />
    </AdminPage>
  );
}
