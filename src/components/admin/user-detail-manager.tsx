"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";

type UserDetail = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  birthProfile: {
    nickname: string | null;
    birthProvince: string | null;
    editCount: number;
  } | null;
  creditWallet: { balance: number } | null;
  usage?: {
    balance: number;
    dailyLimit: number | null;
    monthlyLimit: number | null;
    usedToday: number;
    usedThisMonth: number;
  } | null;
  subscriptions: Array<{
    status: string;
    package: { code: string; name: string; type: string };
    expiresAt: string | null;
  }>;
  creditTxns: Array<{
    id: string;
    amount: number;
    type: string;
    note: string | null;
    createdAt: string;
  }>;
};

export function UserDetailManager({
  userId,
  actorRole = "ADMIN",
}: {
  userId: string;
  /** Role of the signed-in admin acting on this page. */
  actorRole?: "ADMIN" | "SUPER_ADMIN";
}) {
  const canManageRoles = actorRole === "ADMIN" || actorRole === "SUPER_ADMIN";
  const isSuperAdmin = actorRole === "SUPER_ADMIN";
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creditAmount, setCreditAmount] = useState(10);
  const [creditNote, setCreditNote] = useState("");
  const [creditType, setCreditType] = useState<
    "ADMIN_ADD" | "ADMIN_DEDUCT" | "PROMOTION" | "REFUND"
  >("ADMIN_ADD");
  const [packageCode, setPackageCode] = useState("PRO");
  const [expiresAt, setExpiresAt] = useState("");
  const [grantCredits, setGrantCredits] = useState(true);
  const [role, setRole] = useState("");

  const load = useCallback(async () => {
    try {
      setUser(await adminFetch<UserDetail>(`/api/admin/users/${userId}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggleStatus() {
    if (!user) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function adjustCredits(type: typeof creditType) {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        body: JSON.stringify({
          amount: creditAmount,
          type,
          note: creditNote || undefined,
        }),
      });
      setCreditNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ปรับเครดิตไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function setSubscription() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          packageCode,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          grantCredits,
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตั้งแพ็กเกจไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole() {
    if (!role || role === user?.role) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setRole("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปลี่ยนบทบาทไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function resetBirthEdits() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/birth-edits/reset`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "รีเซ็ตโควตาวันเกิดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function resetUsageQuota() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/usage/reset`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "รีเซ็ตโควตาการใช้งานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (!user && !error) {
    return (
      <AdminPage>
        <p className="text-sm text-[var(--muted)]">กำลังโหลด…</p>
      </AdminPage>
    );
  }

  const activeSub = user?.subscriptions.find((s) => s.status === "ACTIVE");

  return (
    <AdminPage>
      <PageHeader
        title={user?.name ?? user?.email ?? "รายละเอียดผู้ใช้"}
        description={user?.email}
        action={
          <Link
            href="/admin/users"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← กลับรายการ
          </Link>
        }
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {user && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold">โปรไฟล์</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="บทบาท" value={user.role} />
              <Row
                label="สถานะ"
                value={
                  <Badge tone={user.status === "ACTIVE" ? "green" : "red"}>
                    {user.status}
                  </Badge>
                }
              />
              <Row label="เครดิตคงเหลือ" value={String(user.creditWallet?.balance ?? 0)} />
              <Row
                label="ใช้วันนี้"
                value={
                  user.usage
                    ? `${user.usage.usedToday}${
                        user.usage.dailyLimit != null
                          ? ` / ${user.usage.dailyLimit}`
                          : " (ไม่จำกัด)"
                      }`
                    : "—"
                }
              />
              <Row
                label="ใช้เดือนนี้"
                value={
                  user.usage
                    ? `${user.usage.usedThisMonth}${
                        user.usage.monthlyLimit != null
                          ? ` / ${user.usage.monthlyLimit}`
                          : " (ไม่จำกัด)"
                      }`
                    : "—"
                }
              />
              <Row
                label="แพ็กเกจ"
                value={activeSub?.package.name ?? "Free (ไม่มี subscription)"}
              />
              <Row
                label="วันเกิด"
                value={
                  user.birthProfile
                    ? `${user.birthProfile.nickname ?? "—"} · ${user.birthProfile.birthProvince ?? "—"} (แก้ ${user.birthProfile.editCount}/1)`
                    : "ยังไม่กรอก"
                }
              />
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={toggleStatus} disabled={busy}>
                {user.status === "ACTIVE" ? "ระงับบัญชี" : "เปิดใช้งาน"}
              </Button>
              <Button variant="ghost" onClick={resetUsageQuota} disabled={busy}>
                รีเซ็ตโควตาการใช้งาน
              </Button>
              {user.birthProfile ? (
                <Button variant="ghost" onClick={resetBirthEdits} disabled={busy}>
                  รีเซ็ตโควตาแก้วันเกิด
                </Button>
              ) : null}
              {canManageRoles &&
              !(actorRole === "ADMIN" && user.role === "SUPER_ADMIN") ? (
                <>
                  <Select
                    value={role || user.role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    {isSuperAdmin ? (
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    ) : null}
                  </Select>
                  <Button
                    variant="ghost"
                    onClick={changeRole}
                    disabled={busy || !role || role === user.role}
                  >
                    มอบ/ถอนสิทธิ์
                  </Button>
                </>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">ตั้งแพ็กเกจ</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="แพ็กเกจ">
                <Select
                  value={packageCode}
                  onChange={(e) => setPackageCode(e.target.value)}
                >
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                </Select>
              </Field>
              <Field label="วันหมดอายุ" hint="เว้นว่าง = ไม่มีกำหนด">
                <TextInput
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Toggle
                checked={grantCredits}
                onChange={setGrantCredits}
                label="เติมเครดิตตามโควตาแพ็กเกจทันที"
              />
              <Button onClick={setSubscription} disabled={busy}>
                บันทึกแพ็กเกจ
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-sm font-semibold">ปรับเครดิต</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Field label="ประเภท">
                <Select
                  value={creditType}
                  onChange={(e) =>
                    setCreditType(e.target.value as typeof creditType)
                  }
                >
                  <option value="ADMIN_ADD">เพิ่ม (Admin)</option>
                  <option value="PROMOTION">โปรโมชัน</option>
                  <option value="REFUND">คืนเครดิต</option>
                  <option value="ADMIN_DEDUCT">หัก (Admin)</option>
                </Select>
              </Field>
              <Field label="จำนวน">
                <TextInput
                  type="number"
                  min={1}
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                />
              </Field>
              <Field label="หมายเหตุ">
                <TextInput
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="เหตุผล (ถ้ามี)"
                />
              </Field>
              <div className="flex items-end">
                <Button
                  variant={creditType === "ADMIN_DEDUCT" ? "danger" : "primary"}
                  onClick={() => adjustCredits(creditType)}
                  disabled={busy}
                >
                  {creditType === "ADMIN_DEDUCT" ? "หักเครดิต" : "เพิ่มเครดิต"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-sm font-semibold">ประวัติเครดิตล่าสุด</h2>
            <ul className="mt-3 space-y-2">
              {user.creditTxns.length === 0 && (
                <li className="text-xs text-[var(--muted)]">ยังไม่มีรายการ</li>
              )}
              {user.creditTxns.map((tx) => (
                <li
                  key={tx.id}
                  className="flex justify-between border-b border-[var(--border)]/50 py-2 text-xs"
                >
                  <span className="text-[var(--muted)]">
                    {tx.type}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </span>
                  <span className={tx.amount >= 0 ? "text-[var(--secondary-active)]" : "text-[var(--danger)]"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
