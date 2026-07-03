"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminPage,
  Badge,
  Card,
  PageHeader,
  StatCard,
  adminFetch,
} from "./ui";

type UsersList = {
  total: number;
  items: Array<{
    subscriptions: Array<{ package: { type: string } }>;
  }>;
};

export function DashboardOverview() {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [proCount, setProCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    adminFetch<UsersList>("/api/admin/users?page=1&pageSize=100")
      .then((data) => {
        if (!alive) return;
        setTotalUsers(data.total);
        const pro = data.items.filter(
          (u) => u.subscriptions[0]?.package.type === "PRO",
        ).length;
        setProCount(pro);
      })
      .catch(() => {
        if (alive) {
          setTotalUsers(0);
          setProCount(0);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AdminPage>
      <PageHeader
        title="ภาพรวม"
        description="สรุปสถานะระบบ — ตัวเลข AI และการชำระเงินจะเติมเมื่อเปิด M3"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={totalUsers ?? "—"} tone="gold" />
        <StatCard
          label="Pro (หน้าแรก)"
          value={proCount ?? "—"}
          hint="นับจาก 100 รายการล่าสุด"
          tone="green"
        />
        <StatCard label="คำขอ AI วันนี้" value="—" hint="รอ M3" />
        <StatCard label="เครดิตที่ใช้ (เดือนนี้)" value="—" hint="รอ M3" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">ทางลัด</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <QuickLink href="/admin/users" label="จัดการผู้ใช้" />
            <QuickLink href="/admin/categories" label="หมวดหมู่" />
            <QuickLink href="/admin/packages" label="แพ็กเกจ" />
            <QuickLink href="/admin/payments" label="การชำระเงิน" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">สถานะระบบ</h2>
            <Badge tone="green">M2 พร้อมใช้</Badge>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-[var(--muted)]">
            <li className="flex justify-between">
              <span>Auth + Birth profile</span>
              <span className="text-[var(--secondary-active)]">พร้อม</span>
            </li>
            <li className="flex justify-between">
              <span>Admin users / categories / packages</span>
              <span className="text-[var(--secondary-active)]">พร้อม</span>
            </li>
            <li className="flex justify-between">
              <span>AI chat + Usage logs</span>
              <span className="text-[var(--muted-2)]">M3</span>
            </li>
            <li className="flex justify-between">
              <span>Manual payment review</span>
              <span className="text-[var(--muted-2)]">M4</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">กิจกรรมล่าสุด</h2>
        <p className="mt-2 text-xs text-[var(--muted)]">
          รายการ error / การชำระเงิน / usage จะแสดงที่นี่เมื่อ API พร้อม (M3–M4)
        </p>
      </Card>
    </AdminPage>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
    >
      {label}
    </Link>
  );
}
