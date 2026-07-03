"use client";

import { AdminPage, EmptyPanel, PageHeader } from "./ui";

export function PaymentsPanel() {
  return (
    <AdminPage>
      <PageHeader
        title="การชำระเงิน (Manual)"
        description="ตรวจสอบหลักฐานโอน · อนุมัติ/ปฏิเสธ · เปิดสิทธิ์ Pro — API จะมาใน M4"
      />
      <EmptyPanel
        title="ยังไม่มีรายการชำระเงิน"
        description="โครงหน้านี้พร้อมแล้ว — เมื่อเปิด M4 จะแสดงตารางคำขอชำระเงิน พร้อมปุ่มอนุมัติ/ปฏิเสธ และลิงก์ไปรายละเอียดผู้ใช้"
      />
    </AdminPage>
  );
}
