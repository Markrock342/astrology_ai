"use client";

import { History, MessagesSquare, Package, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { subscriptionExpiryPayload } from "@/lib/pro-expiry";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  Select,
  StatCard,
  TextInput,
  Toggle,
  adminFetch, IconTile } from "./ui";

import { ConfirmModal } from "@/components/app/confirm-modal";
import { largeAvatarUrl, UserAvatar } from "@/components/app/user-avatar";
import { formatThb, usdToThb } from "@/config/ai-pricing";
import { unitsToQuestions } from "@/lib/usage-budget-display";
import { FALLBACK_PACK_EXPIRY, packExpiryLabel, packExpiryRule, type PackExpiryRule } from "@/lib/pack-expiry";


type PlanOption = {
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  enabled: boolean;
  usageBudgetUnits: number;
  creditOnly?: boolean;
  questionPack?: boolean;
  expiryMode?: "DEFAULT" | "NONE" | "DAYS" | "DATE";
  expiryDays?: number | null;
  expiresOn?: string | null;
};

/** The usage ledger's types in the team's words. */
const LEDGER_TYPE_TH: Record<string, string> = {
  AI_USAGE: "ถามดวง",
  ADMIN_ADD: "แอดมินเพิ่ม",
  ADMIN_DEDUCT: "แอดมินหัก",
  INITIAL_GRANT: "คำถามทดลองตอนสมัคร",
  PROMOTION: "โปรโมชัน",
  PACKAGE_RENEWAL: "เริ่มรอบแพ็กเกจ",
  TOP_UP: "ซื้อแพ็กคำถาม",
  REFUND: "คืนคำถาม",
  MIGRATION: "ย้ายจากระบบเดิม",
};

/** Minutes since a moment (event handlers only, never during render). */
function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

/** "Lite · แพ็กคำถาม 40 คำถาม · ฿50" — what the select shows. */
function planOptionLabel(p: PlanOption): string {
  const q = unitsToQuestions(p.usageBudgetUnits);
  if (p.questionPack) return `${p.name} · แพ็กคำถาม ${q} คำถาม · ฿${p.price}`;
  if (p.type === "FREE") return `${p.name} (ฟรี)`;
  return `${p.name} · ${q} คำถามต่อรอบ · ฿${p.price}`;
}

type UserDetail = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  image: string | null;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
  /** OAuth providers linked to the account, e.g. "google". */
  signInProviders: string[];
  /** Latest message or reading the person sent; null if they never asked. */
  lastActiveAt: string | null;
  birthProfile: {
    hasBirthProfile: true;
    nickname: string | null;
    gender: string | null;
    birthCountry: string | null;
    birthProvince: string | null;
    birthDistrict: string | null;
    birthTimeKnown: boolean;
    editCount: number;
    createdAt: string;
  } | null;
  usage?: {
    balance: number;
    usedPercent: number;
    remainingPercent: number;
    remainingQuestions?: number;
    includedQuestions?: number;
    purchasedQuestions?: number;
    purchasedExpiresAt?: string | null;
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
        amountQuestions?: number;
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
    package: { code: string; name: string; type: string; creditOnly?: boolean };
    expiresAt: string | null;
    startsAt?: string | null;
    createdAt?: string;
    activationSource?: string;
  }>;
  effectivePlan?: "FREE" | "PRO";
  /** The categories Free can ask about (Admin → หมวดดูดวง). */
  freeCategoryNames?: string[];
  planHistory?: Array<{
    action: string;
    at: string;
    by: string;
    packageCode: string | null;
    expiresAt: string | null;
    questionsAdded?: number | null;
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

/** Full Bangkok date and time, plus how long ago — "24 ก.ย. 2569 20:14 · 3 วันที่แล้ว". */
function thaiMoment(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const when = d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  const ago =
    minutes < 1
      ? "เมื่อสักครู่"
      : minutes < 60
        ? `${minutes} นาทีที่แล้ว`
        : minutes < 60 * 24
          ? `${Math.floor(minutes / 60)} ชั่วโมงที่แล้ว`
          : `${Math.floor(minutes / (60 * 24))} วันที่แล้ว`;
  return `${when} · ${ago}`;
}

function signUpMethod(user: { hasPassword: boolean; signInProviders: string[] }): string {
  const ways = user.signInProviders.map((p) => (p === "google" ? "Google" : p));
  if (user.hasPassword) ways.push("อีเมลและรหัสผ่าน");
  return ways.length ? ways.join(" · ") : "—";
}

/** 2026-12-31 → "31 ธ.ค. 2569" (Buddhist year, Bangkok). */
function thaiDay(value: string | null): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [creditType, setCreditType] = useState<
    "ADMIN_ADD" | "ADMIN_DEDUCT" | "PROMOTION" | "REFUND" | "SET"
  >("ADMIN_ADD");
  const [creditSaved, setCreditSaved] = useState<string | null>(null);
  // Moving to Free: also remove bought/given questions (on unless turned off).
  const [clearPurchased, setClearPurchased] = useState(true);
  const [packageCode, setPackageCode] = useState("PRO");
  // The packages the team made (Admin → แพ็กเกจ): the form used to offer only
  // Free and Pro, so a Lite or Plus could not be given by hand (A, 12 Oct 2026).
  const [packages, setPackages] = useState<PlanOption[]>([]);
  const [defaultExpiry, setDefaultExpiry] = useState<PackExpiryRule>(FALLBACK_PACK_EXPIRY);
  useEffect(() => {
    adminFetch<PlanOption[]>("/api/admin/packages")
      .then((rows) => setPackages(rows.filter((p) => !p.creditOnly)))
      .catch(() => {});
    adminFetch<PackExpiryRule>("/api/admin/packages/default-expiry").then(setDefaultExpiry).catch(() => {});
  }, []);
  const chosen = packages.find((p) => p.code === packageCode) ?? null;
  const givingPack = Boolean(chosen?.questionPack);
  const [expiresAt, setExpiresAt] = useState("");
  /** "date" = ends on the chosen day · "forever" = no expiry at all. */
  const [expiryMode, setExpiryMode] = useState<"date" | "forever">("date");
  // Off by default: on, it resets usage to the package's full budget, and
  // being on by default reset users to 100% on every plan or expiry change.
  const [grantCredits, setGrantCredits] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [confirmReset2fa, setConfirmReset2fa] = useState(false);

  const load = useCallback(async () => {
    try {
      const fresh = await adminFetch<UserDetail>(`/api/admin/users/${userId}`);
      setUser(fresh);
      // Show what the account actually has, so the form is never a blank slate
      // that looks like "ไม่มีวันหมด" when a date is in fact set.
      const active = fresh.subscriptions.find((sub) => sub.status === "ACTIVE");
      if (active) {
        // By code: a PRO package the form bug had flipped to FREE-type made
        // this preselect Free, and saving "ตลอดไป" then set Free forever.
        setPackageCode(active.package.code);
        setExpiryMode(active.expiresAt ? "date" : "forever");
        setExpiresAt(active.expiresAt ? active.expiresAt.slice(0, 10) : "");
      }
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
    const have = user?.usage?.remainingQuestions ?? 0;
    const after =
      type === "SET" ? creditAmount : type === "ADMIN_DEDUCT" ? Math.max(0, have - creditAmount) : have + creditAmount;
    if (!window.confirm(`คำถามคงเหลือ ${have} → ${after} คำถาม ยืนยัน?`)) return;
    setBusy(true);
    setCreditSaved(null);
    try {
      await adminFetch<{ remainingQuestions?: number }>(`/api/admin/users/${userId}/credits`, {
        method: "POST",
        body: JSON.stringify({
          amount: creditAmount,
          type,
          note: creditNote || undefined,
        }),
      });
      setCreditNote("");
      await load();
      setCreditSaved(`บันทึกแล้ว — คำถามคงเหลือ ${after} คำถาม`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ปรับคำถามไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function setSubscription() {
    if (givingPack && chosen) {
      const q = unitsToQuestions(chosen.usageBudgetUnits);
      const have = user?.usage?.remainingQuestions ?? 0;
      // Given twice by mistake (A, 12 Oct 2026): the second press added again.
      const recent = user?.planHistory?.find(
        (e) => e.questionsAdded && e.packageCode === chosen.code && minutesSince(e.at) < 30,
      );
      if (
        recent &&
        !window.confirm(
          `เพิ่งให้แพ็ก ${chosen.name} กับผู้ใช้นี้ไปเมื่อ ${Math.max(1, Math.round(minutesSince(recent.at)))} นาทีที่แล้ว — ให้ซ้ำอีกครั้งจริงไหม?`,
        )
      )
        return;
      if (!window.confirm(`ให้แพ็ก ${chosen.name} (+${q} คำถาม)?\nคำถามคงเหลือ ${have} → ${have + q} คำถาม`)) return;
      setBusy(true);
      setSaved(null);
      try {
        await adminFetch(`/api/admin/users/${userId}/subscription`, {
          method: "PATCH",
          body: JSON.stringify({ packageCode, expiresAt: null, grantCredits: false }),
        });
        await load();
        setError(null);
        setSaved(`ให้แพ็ก ${chosen.name} แล้ว — +${q} คำถาม`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ให้แพ็กไม่สำเร็จ");
      } finally {
        setBusy(false);
      }
      return;
    }
    const toFree = chosen ? chosen.type === "FREE" : packageCode === "FREE";
    if (!toFree && expiryMode === "date" && !expiresAt) {
      setError("เลือกวันหมดอายุ หรือเลือก «ไม่มีวันหมดอายุ»");
      return;
    }
    const purchased = user?.usage?.purchasedQuestions ?? 0;
    if (toFree && !window.confirm(
      clearPurchased && purchased > 0
        ? `เปลี่ยนเป็น Free และลบคำถามที่ซื้อ/ให้ไว้ ${purchased} คำถาม?`
        : "เปลี่ยนเป็น Free? (ทุกหมวดจะปิด เหลือเฉพาะหมวดฟรี)",
    )) return;
    setBusy(true);
    setSaved(null);
    try {
      const until = toFree ? null : subscriptionExpiryPayload(expiryMode, expiresAt);
      const res = await adminFetch<{ effectivePlan?: "FREE" | "PRO" }>(`/api/admin/users/${userId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ packageCode, expiresAt: until, grantCredits: toFree ? false : grantCredits, clearPurchased: toFree && clearPurchased }),
      });
      await load();
      if (res?.effectivePlan && res.effectivePlan !== (packageCode === "FREE" ? "FREE" : "PRO")) {
        setError(`บันทึกแล้ว แต่ระบบยังให้สิทธิ์ ${res.effectivePlan} — ดู «การสมัครสมาชิกล่าสุด» ด้านล่างแล้วแจ้งทีม`);
        return;
      }
      setError(null);
      const name = chosen?.name ?? packageCode;
      setSaved(
        toFree
          ? `บันทึกแล้ว — ${name}`
          : expiryMode === "forever"
            ? `บันทึกแล้ว — ${name} ไม่มีวันหมดอายุ`
            : `บันทึกแล้ว — ${name} ถึง ${thaiDay(expiresAt)}`,
      );
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
  const currentPlanLabel = !activeSub
    ? "ยังไม่มีแพ็กเกจที่ใช้งานอยู่"
    : activeSub.expiresAt
      ? `${activeSub.package.name} ถึง ${thaiDay(activeSub.expiresAt)}`
      : `${activeSub.package.name} — ไม่มีวันหมดอายุ`;

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
            <div className="flex items-center gap-3">
              {user.image ? (
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="press-scale shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-[var(--primary)]/60"
                  aria-label="ดูรูปโปรไฟล์ขนาดเต็ม"
                  title="กดเพื่อดูรูปเต็ม"
                >
                  <UserAvatar name={user.name ?? user.email} image={user.image} size={56} />
                </button>
              ) : (
                <UserAvatar name={user.name ?? user.email} image={null} size={56} className="shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">โปรไฟล์</h2>
                <p className="truncate text-[11px] text-[var(--muted)]">
                  {user.image ? "กดที่รูปเพื่อดูขนาดเต็ม" : "ไม่มีรูปโปรไฟล์"}
                </p>
              </div>
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="สมัครเมื่อ" value={thaiMoment(user.createdAt)} />
              <Row
                label="ใช้งานล่าสุด"
                value={user.lastActiveAt ? thaiMoment(user.lastActiveAt) : "ยังไม่เคยถาม"}
              />
              <Row label="สมัครด้วย" value={signUpMethod(user)} />
              <Row
                label="ยืนยันอีเมล"
                value={user.emailVerifiedAt ? `ยืนยันแล้ว · ${thaiDay(user.emailVerifiedAt)}` : "ยังไม่ยืนยัน"}
              />
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
                label="คำถามคงเหลือ"
                value={
                  user.usage && typeof user.usage.remainingQuestions === "number"
                    ? `${user.usage.remainingQuestions.toLocaleString("th-TH")} คำถาม`
                    : "—"
                }
              />
              <Row
                label="จากแพ็กเกจ (Free / รอบเดิม)"
                value={typeof user.usage?.includedQuestions === "number" ? `${user.usage.includedQuestions.toLocaleString("th-TH")} คำถาม` : "—"}
              />
              <Row
                label="ซื้อ / เพิ่มให้"
                value={
                  typeof user.usage?.purchasedQuestions === "number"
                    ? `${user.usage.purchasedQuestions.toLocaleString("th-TH")} คำถาม${
                        user.usage.purchasedExpiresAt ? ` · ถึง ${thaiDay(user.usage.purchasedExpiresAt)}` : ""
                      }`
                    : "—"
                }
              />
              <Row
                label="แพ็กเกจ"
                value={activeSub?.package.name ?? "Free (ไม่มี subscription)"}
              />
              <Row
                // Every pack (Lite, Plus…) opens every category; this is that
                // access, not the package — "PRO" next to "Plus" read as a mistake.
                label="หมวดที่ใช้ได้ตอนนี้"
                value={
                  user.effectivePlan === "PRO" ? (
                    <b className="text-[var(--secondary-active)]">ทุกหมวด</b>
                  ) : (
                    <b className="text-[var(--muted)]">
                      เฉพาะหมวดฟรี{user.freeCategoryNames?.length ? ` (${user.freeCategoryNames.join(" · ")})` : ""}
                    </b>
                  )
                }
              />
              {user.birthProfile ? (
                <>
                  <Row label="ชื่อเล่น" value={user.birthProfile.nickname ?? "—"} />
                  <Row label="เพศ" value={user.birthProfile.gender ?? "—"} />
                  <Row
                    label="สถานที่เกิด"
                    value={[
                      user.birthProfile.birthDistrict,
                      user.birthProfile.birthProvince,
                      user.birthProfile.birthCountry,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  />
                  <Row
                    label="เวลาเกิด"
                    value={user.birthProfile.birthTimeKnown ? "ทราบเวลาเกิด" : "ไม่ทราบเวลาเกิด"}
                  />
                  <Row
                    label="กรอกข้อมูลเกิดเมื่อ"
                    value={`${thaiMoment(user.birthProfile.createdAt)} · แก้แล้ว ${user.birthProfile.editCount}/1`}
                  />
                </>
              ) : (
                <Row label="ข้อมูลวันเกิด" value="ยังไม่กรอก" />
              )}
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
                เติมคำถาม Free / รอบแพ็กเกจให้เต็ม
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
            <h2 className="flex items-center gap-2.5 text-sm font-semibold">
<IconTile icon={Package} tone="gold" size="sm" />ตั้งแพ็กเกจ</h2>
            <p className="mt-1 text-xs text-[var(--muted-2)]">
              ตอนนี้: {currentPlanLabel}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="แพ็กเกจ">
                <Select
                  value={packageCode}
                  onChange={(e) => setPackageCode(e.target.value)}
                >
                  {packages.length === 0 ? (
                    <>
                      <option value="FREE">Free</option>
                      <option value="PRO">Pro</option>
                    </>
                  ) : (
                    <>
                      {packages.filter((p) => p.enabled).map((p) => (
                        <option key={p.code} value={p.code}>
                          {planOptionLabel(p)}
                        </option>
                      ))}
                      {packages.some((p) => !p.enabled) ? (
                        <optgroup label="ปิดขายแล้ว">
                          {packages.filter((p) => !p.enabled).map((p) => (
                            <option key={p.code} value={p.code}>
                              {planOptionLabel(p)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </>
                  )}
                </Select>
              </Field>
              {givingPack && chosen ? (
                <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/6 px-3 py-2 text-xs leading-5 text-[var(--muted)]">
                  <b className="text-[var(--foreground)]">+{unitsToQuestions(chosen.usageBudgetUnits).toLocaleString("th-TH")} คำถาม</b>{" "}
                  บวกเพิ่มจากที่เหลือ · เปิดทุกหมวด ·{" "}
                  {packExpiryLabel(
                    packExpiryRule(
                      { expiryMode: chosen.expiryMode ?? "DEFAULT", expiryDays: chosen.expiryDays ?? null, expiresOn: chosen.expiresOn ?? null },
                      defaultExpiry,
                    ),
                  )}
                  <span className="block text-[11px] text-[var(--muted-2)]">เหมือนลูกค้าซื้อเอง แต่ไม่ต้องมีสลิป — ใช้คืนเงิน ชดเชย หรือขายนอกระบบ</span>
                </div>
              ) : chosen?.type === "FREE" || (!chosen && packageCode === "FREE") ? (
                <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
                  Free ไม่มีวันหมดอายุ · ถามได้เฉพาะหมวดฟรี
                  {(user.usage?.purchasedQuestions ?? 0) > 0 ? (
                    <span className="block text-[11px] text-[var(--muted-2)]">
                      มีคำถามที่ซื้อ/ให้ไว้ {user.usage?.purchasedQuestions} คำถาม — เลือกด้านล่างว่าจะลบด้วยไหม
                    </span>
                  ) : null}
                </div>
              ) : (
              <Field label="อายุแพ็กเกจ">
                <Select
                  value={expiryMode}
                  onChange={(e) =>
                    setExpiryMode(e.target.value === "forever" ? "forever" : "date")
                  }
                >
                  <option value="date">กำหนดวันหมดอายุ</option>
                  <option value="forever">ใช้ได้ตลอดไป (ไม่มีวันหมดอายุ)</option>
                </Select>
              </Field>
              )}
            </div>
            {!givingPack && chosen?.type !== "FREE" && packageCode !== "FREE" && expiryMode === "date" ? (
              <div className="mt-3 sm:max-w-[calc(50%-0.375rem)]">
                <Field label="วันหมดอายุ" hint="หมดอายุตอนสิ้นวันนั้น (เวลาไทย)">
                  <TextInput
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {givingPack ? (
                <span className="text-[11px] text-[var(--muted-2)]">
                  ให้เกินหรือผิด? ลดได้ที่การ์ด «เพิ่ม / หักคำถาม» → ตั้งยอดคงเหลือเป็น
                </span>
              ) : chosen?.type === "FREE" || (!chosen && packageCode === "FREE") ? (
                (user.usage?.purchasedQuestions ?? 0) > 0 ? (
                  <Toggle
                    checked={clearPurchased}
                    onChange={setClearPurchased}
                    label={`ลบคำถามที่ซื้อ/ให้ไว้ ${user.usage?.purchasedQuestions ?? 0} คำถามด้วย (ปิด = ลูกค้าเก็บคำถามไว้ แต่ถามได้เฉพาะหมวดฟรี)`}
                  />
                ) : (
                  <span />
                )
              ) : (
                // Only the old monthly Pro has a round to refill.
                <Toggle
                  checked={grantCredits}
                  onChange={setGrantCredits}
                  label={`เติมคำถามให้เต็มรอบ (${chosen ? unitsToQuestions(chosen.usageBudgetUnits) : "—"} คำถาม) — ไม่เปิด = คำถามคงเดิม`}
                />
              )}
              <Button onClick={setSubscription} disabled={busy}>
                {givingPack ? "ให้แพ็กนี้" : "บันทึกแพ็กเกจ"}
              </Button>
            </div>
            {saved ? (
              <p role="status" className="mt-3 text-xs text-[var(--primary)]">
                {saved}
              </p>
            ) : null}
            {user.planHistory?.length ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <p className="text-xs font-semibold text-[var(--foreground)]">ประวัติการเปลี่ยนแพ็กเกจ</p>
                <ul className="mt-2 space-y-1.5">
                  {user.planHistory.map((e, i) => (
                    <li key={`${e.at}-${i}`} className="text-[11px] leading-5 text-[var(--muted)]">
                      <span className="tabular-nums text-[var(--muted-2)]">
                        {new Date(e.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                      </span>{" "}
                      {e.action === "user.subscription.self_cancel"
                        ? <>ผู้ใช้<b className="text-[var(--danger)]">ยกเลิก Pro เอง</b></>
                        : e.action === "payment.approve"
                          ? <>อนุมัติสลิป {packages.find((p) => p.code === e.packageCode)?.name ?? e.packageCode ?? ""} โดย {e.by}</>
                          : e.questionsAdded
                            ? <>ให้แพ็ก <b className="text-[var(--foreground)]">{packages.find((p) => p.code === e.packageCode)?.name ?? e.packageCode ?? "?"}</b> +{e.questionsAdded} คำถาม{" "}
                                {e.expiresAt ? `ใช้ได้ถึง ${thaiDay(e.expiresAt)}` : "ไม่มีวันหมดอายุ"} โดย {e.by}</>
                            : <>ตั้งเป็น <b className="text-[var(--foreground)]">{packages.find((p) => p.code === e.packageCode)?.name ?? e.packageCode ?? "?"}</b>{" "}
                              {e.expiresAt ? `ถึง ${thaiDay(e.expiresAt)}` : "ไม่มีวันหมดอายุ"} โดย {e.by}</>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {user.subscriptions.length ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <p className="text-[11px] font-semibold text-[var(--muted)]">การสมัครสมาชิกล่าสุด</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {user.subscriptions.map((sub, i) => (
                    <li key={`${sub.createdAt ?? i}-${i}`} className="text-[11px] leading-5 text-[var(--muted)]">
                      <span className={sub.status === "ACTIVE" ? "font-semibold text-[var(--foreground)]" : ""}>
                        {sub.status}
                      </span>{" "}
                      · {sub.package.name} ({sub.package.code} · ชนิด{" "}
                      <b className={sub.package.type === "PRO" ? "text-[var(--primary)]" : "text-[var(--danger)]"}>
                        {sub.package.type}
                      </b>
                      {sub.package.creditOnly ? " · เติม usage" : ""})
                      {" · "}
                      {sub.expiresAt ? `ถึง ${thaiDay(sub.expiresAt)}` : "ไม่มีวันหมดอายุ"}
                      {sub.activationSource ? ` · ${sub.activationSource}` : ""}
                      {sub.createdAt ? ` · สร้าง ${thaiDay(sub.createdAt)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {user.cost ? (
            <Card className="lg:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2.5 text-sm font-semibold">
<IconTile icon={TrendingUp} tone="green" size="sm" />ต้นทุนและกำไร · เดือนนี้</h2>
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
            <h2 className="flex items-center gap-2.5 text-sm font-semibold">
<IconTile icon={MessagesSquare} tone="blue" size="sm" />เพิ่ม / หักคำถาม</h2>
            <p className="mt-1 text-xs text-[var(--muted-2)]">
              คงเหลือตอนนี้ {user.usage?.remainingQuestions ?? 0} คำถาม · หักจะลดคำถามที่ซื้อ/ให้ไว้ก่อน แล้วจึงลดคำถาม Free
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Field label="ประเภท">
                <Select
                  value={creditType}
                  onChange={(e) =>
                    setCreditType(e.target.value as typeof creditType)
                  }
                >
                  <option value="ADMIN_ADD">เพิ่ม</option>
                  <option value="ADMIN_DEDUCT">หัก</option>
                  <option value="SET">ตั้งยอดคงเหลือเป็น</option>
                  <option value="PROMOTION">เพิ่ม (โปรโมชัน)</option>
                  <option value="REFUND">เพิ่ม (คืนคำถาม)</option>
                </Select>
              </Field>
              <Field label="จำนวน (คำถาม)">
                <TextInput
                  type="number"
                  min={creditType === "SET" ? 0 : 1}
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
                  {creditType === "ADMIN_DEDUCT" ? "หักคำถาม" : creditType === "SET" ? "ตั้งยอด" : "เพิ่มคำถาม"}
                </Button>
              </div>
            </div>
            {creditSaved ? (
              <p role="status" className="mt-3 text-xs text-[var(--primary)]">
                {creditSaved}
              </p>
            ) : null}
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold">
<IconTile icon={History} tone="muted" size="sm" />ประวัติการใช้คำถาม</h2>
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
                    {LEDGER_TYPE_TH[tx.type] ?? tx.type}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </span>
                  <span className={tx.amountPercent >= 0 ? "text-[var(--secondary-active)]" : "text-[var(--danger)]"}>
                    {tx.amountPercent >= 0 ? "+" : ""}
                    {tx.amountQuestions != null ? `${tx.amountQuestions} คำถาม` : `${tx.amountPercent}%`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {isSuperAdmin ? (
            <Card className="lg:col-span-2 border-[var(--danger)]/40">
              <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[var(--danger)]">
<IconTile icon={Trash2} tone="red" size="sm" />
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
      <Modal
        open={photoOpen && Boolean(user?.image)}
        title={user?.name ?? user?.email ?? "รูปโปรไฟล์"}
        size="lg"
        onClose={() => setPhotoOpen(false)}
      >
        {user?.image ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={largeAvatarUrl(user.image)}
              alt={`รูปโปรไฟล์ ${user.name ?? user.email}`}
              referrerPolicy="no-referrer"
              className="max-h-[70dvh] w-auto max-w-full rounded-2xl object-contain"
            />
            <a
              href={largeAvatarUrl(user.image)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[var(--primary)] underline"
            >
              เปิดรูปในแท็บใหม่
            </a>
          </div>
        ) : null}
      </Modal>
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
