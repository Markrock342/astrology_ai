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

export function UserDetailManager({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creditAmount, setCreditAmount] = useState(10);
  const [creditNote, setCreditNote] = useState("");
  const [packageCode, setPackageCode] = useState("PRO");

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

  async function adjustCredits(type: "ADMIN_ADD" | "ADMIN_DEDUCT") {
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
        body: JSON.stringify({ packageCode }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตั้งแพ็กเกจไม่สำเร็จ");
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
            <div className="mt-4">
              <Button variant="ghost" onClick={toggleStatus} disabled={busy}>
                {user.status === "ACTIVE" ? "ระงับบัญชี" : "เปิดใช้งาน"}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">ตั้งแพ็กเกจ</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Select
                value={packageCode}
                onChange={(e) => setPackageCode(e.target.value)}
                className="max-w-[160px]"
              >
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
              </Select>
              <Button onClick={setSubscription} disabled={busy}>
                บันทึกแพ็กเกจ
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-sm font-semibold">ปรับเครดิต</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
              <div className="flex items-end gap-2">
                <Button onClick={() => adjustCredits("ADMIN_ADD")} disabled={busy}>
                  เพิ่ม
                </Button>
                <Button
                  variant="danger"
                  onClick={() => adjustCredits("ADMIN_DEDUCT")}
                  disabled={busy}
                >
                  หัก
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
