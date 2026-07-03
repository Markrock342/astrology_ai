"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  PageHeader,
  Select,
  TableShell,
  Td,
  TextInput,
  Th,
  adminFetch,
} from "./ui";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  creditWallet: { balance: number } | null;
  subscriptions: Array<{
    package: { code: string; type: string };
    expiresAt: string | null;
  }>;
};

type UsersResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: UserRow[];
};

export function UsersManager() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      setData(await adminFetch<UsersResponse>(`/api/admin/users?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    }
  }, [page, search, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminPage>
      <PageHeader
        title="ผู้ใช้"
        description="ค้นหา · เปิด-ปิดบัญชี · ตั้งแพ็กเกจ · ปรับเครดิต — ทุกการเปลี่ยนแปลงลง audit log"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          placeholder="ค้นหาชื่อหรืออีเมล…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="max-w-[140px]"
        >
          <option value="">ทุกสถานะ</option>
          <option value="ACTIVE">ใช้งาน</option>
          <option value="DISABLED">ระงับ</option>
        </Select>
        <Button variant="ghost" onClick={() => void load()}>
          รีเฟรช
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}

      <TableShell>
        <thead>
          <tr>
            <Th>ผู้ใช้</Th>
            <Th>แพ็กเกจ</Th>
            <Th>เครดิต</Th>
            <Th>สถานะ</Th>
            <Th>สมัครเมื่อ</Th>
            <Th className="text-right">จัดการ</Th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((u) => {
            const sub = u.subscriptions[0];
            const plan = sub?.package.type ?? "FREE";
            return (
              <tr key={u.id} className="hover:bg-[var(--surface-2)]/50">
                <Td>
                  <p className="font-medium">{u.name ?? "—"}</p>
                  <p className="text-xs text-[var(--muted)]">{u.email}</p>
                </Td>
                <Td>
                  <Badge tone={plan === "PRO" ? "gold" : "muted"}>{plan}</Badge>
                </Td>
                <Td>{u.creditWallet?.balance ?? 0}</Td>
                <Td>
                  <Badge tone={u.status === "ACTIVE" ? "green" : "red"}>
                    {u.status === "ACTIVE" ? "ใช้งาน" : "ระงับ"}
                  </Badge>
                </Td>
                <Td className="text-xs text-[var(--muted)]">
                  {new Date(u.createdAt).toLocaleDateString("th-TH")}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    รายละเอียด
                  </Link>
                </Td>
              </tr>
            );
          })}
          {data?.items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                ไม่พบผู้ใช้
              </td>
            </tr>
          )}
        </tbody>
      </TableShell>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          ทั้งหมด {data?.total ?? 0} คน · หน้า {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </Button>
        </div>
      </div>
    </AdminPage>
  );
}
