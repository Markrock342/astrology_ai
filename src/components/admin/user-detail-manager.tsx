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
  StatCard,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";
import { ConfirmModal } from "@/components/app/confirm-modal";
import { formatThb, usdToThb } from "@/config/ai-pricing";

type UserDetail = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  birthProfile: {
    hasBirthProfile: true;
    nickname: string | null;
    birthProvince: string | null;
    editCount: number;
  } | null;
  usage?: {
    balance: number;
    usedPercent: number;
    remainingPercent: number;
    includedRemainingPercent: number;
    purchasedRemainingPercent: number;
    dailyLimit: number | null;
    monthlyLimit: number | null;
    usedToday: number;
    usedThisMonth: number;
    history: {
      items: Array<{
        id: string;
        amountPercent: number;
        type: string;
        note: string | null;
        createdAt: string;
      }>;
    };
  } | null;
  cost?: {
    plan: "FREE" | "PRO";
    packageName: string | null;
    revenueThb: number;
    readings: number;
    aiCalls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    costPerReadingUsd: number | null;
    hasUnpricedModel: boolean;
  } | null;
  subscriptions: Array<{
    status: string;
    package: { code: string; name: string; type: string };
    expiresAt: string | null;
  }>;
};

type RevealedBirth = {
  nickname: string | null;
  birthDate: string;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthProvince: string | null;
  birthDistrict: string | null;
  birthCountry: string;
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
  const [revealedBirth, setRevealedBirth] = useState<RevealedBirth | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [creditType, setCreditType] = useState<
    "ADMIN_ADD" | "ADMIN_DEDUCT" | "PROMOTION" | "REFUND"
  >("ADMIN_ADD");
  const [packageCode, setPackageCode] = useState("PRO");
  const [expiresAt, setExpiresAt] = useState("");
  const [grantCredits, setGrantCredits] = useState(true);
  const [role, setRole] = useState("");
  const [confirmReset2fa, setConfirmReset2fa] = useState(false);

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

  async function resetTarget2fa() {
    if (!user || !isSuperAdmin) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}/reset-2fa`, {
        method: "POST",
      });
      setError(null);
      setConfirmReset2fa(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "รีเซ็ต 2FA ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function revealBirth() {
    setBusy(true);
    try {
      const data = await adminFetch<RevealedBirth>(
        `/api/admin/users/${userId}/birth-reveal`,
        { method: "POST" },
      );
      setRevealedBirth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดเผยวันเกิดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!user || !isSuperAdmin) return;
    if (deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError("พิมพ์อีเมลผู้ใช้ให้ตรงเพื่อยืนยันการลบ");
      return;
    }
    setBusy(true);
    try {
      await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      window.location.href = "/admin/users";
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบบัญชีไม่สำเร็จ");
      setBusy(false);
    }
  }

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
      setError(e instanceof Error ? e.message : "ปรับ usage ไม่สำเร็จ");
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
              <Row
                label="usage คงเหลือ"
                value={user.usage ? `${user.usage.remainingPercent}%` : "—"}
              />
              <Row
                label="usage จากรอบแพ็กเกจ"
                value={user.usage ? `${user.usage.includedRemainingPercent}%` : "—"}
              />
              <Row
                label="usage เติมเพิ่ม"
                value={user.usage ? `${user.usage.purchasedRemainingPercent}%` : "—"}
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
              {revealedBirth ? (
                <Row
                  label="วันเกิดเต็ม"
                  value={`${new Date(revealedBirth.birthDate).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · เวลา ${revealedBirth.birthTime ?? "—"} · ${revealedBirth.birthDistrict ?? "—"} ${revealedBirth.birthProvince ?? ""}`}
                />
              ) : null}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {user.birthProfile && !revealedBirth ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "เปิดเผยวันเกิดเต็มจะถูกบันทึกใน audit — ดำเนินการต่อ?",
                      )
                    ) {
                      return;
                    }
                    void revealBirth();
                  }}
                >
                  แสดงวันเกิดเต็ม
                </Button>
              ) : revealedBirth ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRevealedBirth(null)}
                >
                  ซ่อนวันเกิด
                </Button>
              ) : null}
              <Button variant="ghost" onClick={toggleStatus} disabled={busy}>
                {user.status === "ACTIVE" ? "ระงับบัญชี" : "เปิดใช้งาน"}
              </Button>
              <Button variant="ghost" onClick={resetUsageQuota} disabled={busy}>
                คืน usage รอบนี้เป็น 100%
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
                label="เริ่ม usage ของแพ็กเกจที่ 100% ทันที"
              />
              <Button onClick={setSubscription} disabled={busy}>
                บันทึกแพ็กเกจ
              </Button>
            </div>
          </Card>

          {user.cost ? (
            <Card className="lg:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">ต้นทุนและกำไร · เดือนนี้</h2>
                <Link
                  href="/admin/costs"
                  className="text-[11px] text-[var(--primary)] hover:underline"
                >
                  ดูทุกผู้ใช้ →
                </Link>
              </div>

              {(() => {
                const c = user.cost;
                const costThb = usdToThb(c.costUsd);
                const profit = c.revenueThb - costThb;
                const losing = costThb > c.revenueThb;
                return (
                  <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <StatCard
                        label="รายได้"
                        value={c.revenueThb > 0 ? `฿${c.revenueThb}` : "—"}
                        hint={c.packageName ?? "ไม่มีแพ็กเกจ"}
                        tone="gold"
                      />
                      <StatCard
                        label="ต้นทุน AI"
                        value={`${formatThb(c.costUsd)}${c.hasUnpricedModel ? "~" : ""}`}
                        hint={`${c.aiCalls} ครั้งที่เรียกโมเดล`}
                      />
                      <StatCard
                        label={profit >= 0 ? "กำไร" : "ขาดทุน"}
                        value={`฿${Math.abs(profit).toFixed(profit === 0 ? 0 : 2)}`}
                        hint={
                          c.revenueThb > 0
                            ? `margin ${(((c.revenueThb - costThb) / c.revenueThb) * 100).toFixed(0)}%`
                            : "ผู้ใช้ฟรี — ต้นทุนล้วน"
                        }
                        tone={losing ? "danger" : "green"}
                      />
                      <StatCard
                        label="ต่อคำทำนาย"
                        value={
                          c.costPerReadingUsd != null
                            ? formatThb(c.costPerReadingUsd)
                            : "—"
                        }
                        hint={`${c.readings} คำทำนาย`}
                      />
                    </div>

                    <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                      <Row
                        label="Token เข้า (prompt)"
                        value={c.inputTokens.toLocaleString("th-TH")}
                      />
                      <Row
                        label="Token ออก (คำตอบ)"
                        value={c.outputTokens.toLocaleString("th-TH")}
                      />
                    </dl>

                    <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted-2)]">
                      Output แพงกว่า input 6 เท่า ($9.00 vs $1.50 ต่อ 1M token) —
                      ความยาวคำตอบคือตัวชี้ขาดต้นทุน ไม่ใช่ขนาด prompt
                      {c.aiCalls > c.readings
                        ? ` · รวมการเรียกโมเดลเสริม ${c.aiCalls - c.readings} ครั้ง (สรุป/คำถามต่อ) ที่ยังไม่รวมใน usage แต่มีต้นทุน`
                        : ""}
                    </p>
                  </>
                );
              })()}
            </Card>
          ) : null}

          <Card className="lg:col-span-2">
            <h2 className="text-sm font-semibold">ปรับ usage</h2>
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
                  <option value="REFUND">คืน usage</option>
                  <option value="ADMIN_DEDUCT">หัก (Admin)</option>
                </Select>
              </Field>
              <Field label="จำนวน (%)">
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
                  {creditType === "ADMIN_DEDUCT" ? "หัก usage" : "เพิ่ม usage"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-sm font-semibold">ประวัติ usage ล่าสุด</h2>
            <ul className="mt-3 space-y-2">
              {(user.usage?.history.items.length ?? 0) === 0 && (
                <li className="text-xs text-[var(--muted)]">ยังไม่มีรายการ</li>
              )}
              {user.usage?.history.items.map((tx) => (
                <li
                  key={tx.id}
                  className="flex justify-between border-b border-[var(--border)]/50 py-2 text-xs"
                >
                  <span className="text-[var(--muted)]">
                    {tx.type}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </span>
                  <span className={tx.amountPercent >= 0 ? "text-[var(--secondary-active)]" : "text-[var(--danger)]"}>
                    {tx.amountPercent >= 0 ? "+" : ""}
                    {tx.amountPercent}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {isSuperAdmin ? (
            <Card className="lg:col-span-2 border-[var(--danger)]/40">
              <h2 className="text-sm font-semibold text-[var(--danger)]">
                ลบบัญชีผู้ใช้ (PDPA)
              </h2>
              <p className="mt-2 text-xs text-[var(--muted)]">
                ลบถาวรพร้อมสลิป — พิมพ์อีเมล {user.email} เพื่อยืนยัน
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Field label="ยืนยันอีเมล">
                  <TextInput
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={user.email}
                  />
                </Field>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => void deleteUser()}
                >
                  ลบบัญชีถาวร
                </Button>
              </div>
              {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") &&
              user.id !== undefined ? (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <p className="text-xs text-[var(--muted)]">
                    รีเซ็ต TOTP ของแอดมินนี้ (บังคับตั้งค่าใหม่)
                  </p>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmReset2fa(true)}
                  >
                    รีเซ็ต 2FA
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}
      <ConfirmModal
        open={confirmReset2fa}
        danger
        busy={busy}
        title="รีเซ็ต 2FA ของผู้ใช้นี้?"
        message="จะต้อง enroll ใหม่"
        confirmLabel="รีเซ็ต"
        onCancel={() => {
          if (!busy) setConfirmReset2fa(false);
        }}
        onConfirm={() => void resetTarget2fa()}
      />
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
