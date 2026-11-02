"use client";

import { unitsToQuestions } from "@/lib/usage-budget-display";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/app/user-avatar";
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

import { PageJump, SortableTh } from "./table-controls";

type UserSort = "recent" | "newest" | "name" | "role" | "package" | "purchasedAt" | "expiresAt" | "balance" | "status";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  role: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  /** Latest message or reading the person sent; null if they never asked. */
  lastActiveAt: string | null;
  usageWallet: {
    includedBalanceUnits: number;
    includedAllowanceUnits: number;
    purchasedBalanceUnits: number;
    purchasedExpiresAt: string | null;
  } | null;
  latestPurchase: {
    packageCode: string | null;
    packageName: string | null;
    purchasedAt: string;
  } | null;
  subscriptions: Array<{
    package: { code: string; type: string; name?: string; questionPack?: boolean };
    startsAt?: string;
    expiresAt: string | null;
  }>;
};

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });

/** "เมื่อสักครู่" · "12 นาทีที่แล้ว" · "3 ชั่วโมงที่แล้ว" · "5 วันที่แล้ว" · a date past a month. */
function timeAgo(iso: string): string {
  const d = new Date(iso);
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`;
  const days = Math.floor(minutes / (60 * 24));
  if (days <= 30) return `${days} วันที่แล้ว`;
  return d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
}

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
  const [sort, setSort] = useState<UserSort>("recent");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [packageCode, setPackageCode] = useState("");
  const [packages, setPackages] = useState<Array<{code: string; name: string; type: string; creditOnly: boolean}>>([]);
  const requestId = useRef(0);
  useEffect(() => {
    adminFetch<Array<{code: string; name: string; type: string; creditOnly: boolean}>>("/api/admin/packages").then(setPackages).catch(() => {});
  }, []);
  function changeSort(field: UserSort) {
    setDirection(sort === field && direction === "asc" ? "desc" : "asc");
    setSort(field);
    setPage(1);
  }
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
    const id = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (status) params.set("status", status);
      params.set("sort", sort);
      params.set("direction", direction);
      if (packageCode) params.set("packageCode", packageCode);
      const result = await adminFetch<UsersResponse>(`/api/admin/users?${params}`);
      if (id !== requestId.current) return;
      setData(result);
      setPage(result.page);
      setError(null);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, debouncedSearch, status, sort, direction, packageCode]);

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
        description="ค้นหา · เปิด-ปิดบัญชี · ตั้งแพ็กเกจ · เพิ่ม/หักคำถาม — ทุกการเปลี่ยนแปลงลง audit log"
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
        <Select aria-label="แพ็กเกจปัจจุบัน" value={packageCode} className="max-w-[200px]"
          onChange={(e) => { setPackageCode(e.target.value); setPage(1); }}>
          <option value="">ทุกแพ็กเกจปัจจุบัน</option>
          <option value="FREE">Free (ฟรี)</option>
          {packages.filter((p) => p.type === "PRO" && !p.creditOnly).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </Select>
        <PageJump key={`${page}-${totalPages}`} page={page} totalPages={totalPages} disabled={loading} onPage={setPage} />
        <Button variant="ghost" onClick={() => void load()}>
          รีเฟรช
        </Button>
      </div>

      <p className="mb-3 text-xs text-[var(--muted-foreground)]">
        Free รวมผู้สมัครใหม่และผู้ที่แพ็กหมดอายุ · คอลัมน์แพ็กล่าสุดแสดงประวัติซื้อ
      </p>
      {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}

      {loading ? (
        <TableSkeleton />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <SortableTh label="ผู้ใช้" active={sort === "name"} direction={direction} onClick={() => changeSort("name")} />
              <SortableTh label="บทบาท" active={sort === "role"} direction={direction} onClick={() => changeSort("role")} />
              <SortableTh label="แพ็กล่าสุด" active={sort === "package"} direction={direction} onClick={() => changeSort("package")} />
              <SortableTh label="ซื้อเมื่อ" active={sort === "purchasedAt"} direction={direction} onClick={() => changeSort("purchasedAt")} />
              <SortableTh label="คำถามหมดอายุ" active={sort === "expiresAt"} direction={direction} onClick={() => changeSort("expiresAt")} />
              <SortableTh label="คำถามเหลือ" active={sort === "balance"} direction={direction} onClick={() => changeSort("balance")} />
              <SortableTh label="สถานะ" active={sort === "status"} direction={direction} onClick={() => changeSort("status")} />
              <SortableTh label="ใช้งานล่าสุด" active={sort === "recent"} direction={direction} onClick={() => changeSort("recent")} />
              <SortableTh label="สมัครเมื่อ" active={sort === "newest"} direction={direction} onClick={() => changeSort("newest")} />
              <Th className="text-right">จัดการ</Th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => {
              return (
                <tr key={u.id} className="group hover:bg-[var(--surface-2)]/50">
                  <Td className="whitespace-nowrap">
                    {/* The whole person opens their profile — not only the
                        small "รายละเอียด" link at the far end of the row. */}
                    <Link
                      href={`/admin/users/${u.id}`}
                      title={`${u.name ?? ""} · ${u.email}`}
                      className="-m-1 flex w-60 max-w-60 items-center gap-3 rounded-lg p-1 transition hover:bg-[var(--surface-2)]"
                    >
                      <UserAvatar name={u.name} image={u.image} size={36} className="shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:text-[var(--primary)]">
                          {u.name ?? "—"}
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">{u.email}</p>
                      </div>
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
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
                  <Td className="whitespace-nowrap">
                    {u.latestPurchase?.packageName ? (
                      <Badge tone="gold">{u.latestPurchase.packageName}</Badge>
                    ) : (
                      <span className="text-[var(--muted-2)]">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                    {u.latestPurchase?.purchasedAt ? shortDay(u.latestPurchase.purchasedAt) : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-[var(--muted)]">
                    {u.usageWallet?.purchasedExpiresAt
                      ? shortDay(u.usageWallet.purchasedExpiresAt)
                      : u.usageWallet && u.usageWallet.purchasedBalanceUnits > 0
                        ? "ไม่มีวันหมด"
                        : "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {u.usageWallet
                      ? `${unitsToQuestions(
                          u.usageWallet.includedBalanceUnits + u.usageWallet.purchasedBalanceUnits,
                        ).toLocaleString("th-TH")} คำถาม`
                      : "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={u.status === "ACTIVE" ? "green" : "red"}>
                      {u.status === "ACTIVE" ? "ใช้งาน" : "ระงับ"}
                    </Badge>
                  </Td>
                  <Td className="text-xs">
                    {u.lastActiveAt ? (
                      <span title={new Date(u.lastActiveAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}>
                        {timeAgo(u.lastActiveAt)}
                      </span>
                    ) : (
                      <span className="text-[var(--muted-2)]">ยังไม่เคยถาม</span>
                    )}
                  </Td>
                  <Td className="text-xs text-[var(--muted)]">
                    {new Date(u.createdAt).toLocaleDateString("th-TH")}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
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
                <td colSpan={10} className="px-4 py-8 text-center text-[var(--muted)]">
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
          <Button variant="ghost" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <Button
            variant="ghost"
            disabled={loading || page >= totalPages}
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
