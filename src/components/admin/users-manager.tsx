"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Field,
  Modal,
  PageHeader,
  Select,
  TableShell,
  TableSkeleton,
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

export function UsersManager({
  actorRole = "ADMIN",
}: {
  actorRole?: "ADMIN" | "SUPER_ADMIN";
}) {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [staffRole, setStaffRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const canCreateStaff = actorRole === "SUPER_ADMIN";

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status) params.set("status", status);
      setData(await adminFetch<UsersResponse>(`/api/admin/users?${params}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function createStaff() {
    setCreating(true);
    setCreateError(null);
    try {
      await adminFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          password,
          role: staffRole,
        }),
      });
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setStaffRole("ADMIN");
      setPage(1);
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "สร้างไม่สำเร็จ");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="ผู้ใช้"
        description="ค้นหา · เปิด-ปิดบัญชี · ตั้งแพ็กเกจ · ปรับเครดิต — ทุกการเปลี่ยนแปลงลง audit log"
        action={
          canCreateStaff ? (
            <Button onClick={() => setCreateOpen(true)}>เพิ่มแอดมิน</Button>
          ) : undefined
        }
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

      {loading ? (
        <TableSkeleton />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>ผู้ใช้</Th>
              <Th>บทบาท</Th>
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
                    <Badge
                      tone={
                        u.role === "SUPER_ADMIN"
                          ? "gold"
                          : u.role === "ADMIN"
                            ? "green"
                            : "muted"
                      }
                    >
                      {u.role}
                    </Badge>
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
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  ไม่พบผู้ใช้
                </td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

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

      <Modal
        open={createOpen}
        title="เพิ่มแอดมิน"
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--muted)]">
            สร้างบัญชีใหม่ให้เข้าหลังบ้านได้ทันที — ถ้าอีเมลมีในระบบแล้ว ให้ไปมอบสิทธิ์ที่หน้ารายละเอียดผู้ใช้
          </p>
          <Field label="ชื่อ">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อที่แสดง"
              autoComplete="name"
            />
          </Field>
          <Field label="อีเมล">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="off"
              required
            />
          </Field>
          <Field label="รหัสผ่าน" hint="อย่างน้อย 8 ตัวอักษร">
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="บทบาท">
            <Select
              value={staffRole}
              onChange={(e) =>
                setStaffRole(e.target.value as "ADMIN" | "SUPER_ADMIN")
              }
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </Select>
          </Field>
          {createError ? (
            <p className="text-sm text-[var(--danger)]">{createError}</p>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              disabled={creating || !email.trim() || password.length < 8}
              onClick={() => void createStaff()}
            >
              {creating ? "กำลังสร้าง…" : "สร้างแอดมิน"}
            </Button>
          </div>
        </div>
      </Modal>
    </AdminPage>
  );
}
