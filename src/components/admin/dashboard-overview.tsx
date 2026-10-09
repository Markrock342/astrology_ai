"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  Clock,
  Cpu,
  Crown,
  Database,
  HardDriveUpload,
  KeyRound,
  Mail,
  MessagesSquare,
  Package,
  ReceiptText,
  ShieldCheck,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AdminDashboardSkeleton } from "@/components/app/content-skeleton";
import { ADMIN_NAV } from "@/config/admin-nav";
import { AdminPage, Card, CardTitle, IconTile, PageHeader, StatCard, adminFetch } from "./ui";
import { AdminPushEnable } from "./admin-push-enable";

type DashboardStats = {
  users: { total: number; active: number; pro: number; newThisWeek: number };
  ai: { requestsToday: number; errorsToday: number; requestsThisMonth: number };
  money: { revenueThisMonth: number; revenueToday: number; aiCostThisMonthThb: number; answersThisMonth: number };
  payments: { pending: number; pendingOverdue?: number };
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string;
    admin: { email: string; name: string | null };
  }>;
};

type OpsHealth = {
  database: { connected: boolean; latencyMs: number | null; checkedAt: string };
  nodeEnv: string;
  rateLimitBackend: "upstash" | "memory";
  upstashConfigured: boolean;
  blobConfigured: boolean;
  emailConfigured: boolean;
  cronSecretSet: boolean;
  aiSecretEncConfigured: boolean;
  vapidConfigured: boolean;
};

const num = (v: number) => v.toLocaleString("th-TH");
const baht = (v: number) => `฿${v.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
const time = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });

/** What an audit action means, in words the team uses, with an icon. */
function describeAction(action: string): { label: string; icon: LucideIcon; tone: "gold" | "green" | "red" | "blue" | "violet" | "muted" } {
  if (action === "payment.approve") return { label: "อนุมัติสลิป", icon: CheckCircle2, tone: "green" };
  if (action === "payment.reject") return { label: "ปฏิเสธสลิป", icon: XCircle, tone: "red" };
  if (action === "user.subscription.set") return { label: "เปลี่ยนแพ็กเกจผู้ใช้", icon: UserCog, tone: "gold" };
  if (action === "user.usage.adjust") return { label: "เพิ่ม/หักคำถามผู้ใช้", icon: MessagesSquare, tone: "blue" };
  if (action === "user.usage_budget.reset") return { label: "รีเซ็ตคำถามผู้ใช้", icon: MessagesSquare, tone: "blue" };
  if (action === "usage.repair_pro_lapse") return { label: "คืนยอดลูกค้า Pro", icon: ShieldCheck, tone: "green" };
  if (action.startsWith("package.")) return { label: "แก้แพ็กเกจ", icon: Package, tone: "gold" };
  if (action.startsWith("ai_config") || action.startsWith("ai.")) return { label: "ตั้งค่าโมเดล AI", icon: Cpu, tone: "violet" };
  if (action.startsWith("admin.2fa")) return { label: "ตั้งค่า 2FA แอดมิน", icon: KeyRound, tone: "muted" };
  if (action.startsWith("setting") || action.startsWith("cms")) return { label: "แก้ข้อความเว็บ", icon: Activity, tone: "muted" };
  if (action.startsWith("user.")) return { label: "แก้ข้อมูลผู้ใช้", icon: UserCog, tone: "muted" };
  return { label: action, icon: Activity, tone: "muted" };
}

const SHORTCUTS = [
  "/admin/payments",
  "/admin/users",
  "/admin/packages",
  "/admin/costs",
  "/admin/ai-configs",
  "/admin/readings",
  "/admin/feedback",
  "/admin/settings",
];

export function DashboardOverview({ initialStats }: { initialStats?: DashboardStats | null }) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats ?? null);
  const [ops, setOps] = useState<OpsHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialStats);

  useEffect(() => {
    let alive = true;
    adminFetch<OpsHealth>("/api/admin/ops-health")
      .then((data) => {
        if (alive) setOps(data);
      })
      .catch(() => {
        /* ops health is optional on dashboard */
      });
    if (initialStats) return () => {
      alive = false;
    };
    adminFetch<DashboardStats>("/api/admin/dashboard")
      .then((data) => {
        if (alive) setStats(data);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialStats]);

  const m = stats?.money;
  const profit = m ? m.revenueThisMonth - m.aiCostThisMonthThb : null;
  const perAnswer = m && m.answersThisMonth > 0 ? m.aiCostThisMonthThb / m.answersThisMonth : null;
  const free = stats ? stats.users.total - stats.users.pro : 0;
  const proShare = stats && stats.users.total > 0 ? Math.round((stats.users.pro / stats.users.total) * 100) : 0;

  return (
    <AdminPage>
      <PageHeader title="ภาพรวม" description="ผู้ใช้ รายได้ ต้นทุน AI และสถานะระบบ ในหน้าเดียว" />

      {stats && stats.payments.pending > 0 ? (
        <Link
          href="/admin/payments"
          className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
            (stats.payments.pendingOverdue ?? 0) > 0
              ? "border-[var(--danger)]/40 bg-[var(--danger)]/8 hover:bg-[var(--danger)]/12"
              : "border-[var(--primary)]/40 bg-[var(--primary)]/8 hover:bg-[var(--primary)]/12"
          }`}
        >
          <IconTile icon={ReceiptText} tone={(stats.payments.pendingOverdue ?? 0) > 0 ? "red" : "gold"} />
          <span className="min-w-0 flex-1 text-sm text-[var(--foreground)]">
            <b>สลิปรอตรวจ {num(stats.payments.pending)} รายการ</b>
            {(stats.payments.pendingOverdue ?? 0) > 0 ? (
              <span className="text-[var(--danger)]"> · ค้างเกิน 48 ชม. {num(stats.payments.pendingOverdue ?? 0)}</span>
            ) : null}
            <span className="block text-xs text-[var(--muted)]">ลูกค้าได้คำถามทันทีที่อนุมัติ</span>
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
            ตรวจสลิป <ArrowRight size={14} aria-hidden />
          </span>
        </Link>
      ) : null}

      {ops && !ops.blobConfigured ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-4 py-3">
          <IconTile icon={HardDriveUpload} tone="red" />
          <p className="text-sm text-[var(--foreground)]">
            <b>ลูกค้าส่งสลิปไม่ได้</b> — เซิร์ฟเวอร์ยังไม่มี BLOB_READ_WRITE_TOKEN
            <span className="block text-xs text-[var(--muted)]">ใส่ใน Coolify → horasard-web → Environment Variables แล้ว Redeploy</span>
          </p>
        </div>
      ) : null}

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {loading && !stats ? (
        <AdminDashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="ผู้ใช้ทั้งหมด"
              value={stats ? num(stats.users.total) : "—"}
              hint={stats ? `ใหม่ 7 วัน +${num(stats.users.newThisWeek)} คน` : undefined}
              icon={Users}
              tone="gold"
              href="/admin/users"
            />
            <StatCard
              label="ใช้แพ็กจ่ายเงิน / Pro"
              value={stats ? num(stats.users.pro) : "—"}
              hint={stats ? `${proShare}% ของผู้ใช้ทั้งหมด` : undefined}
              icon={Crown}
              tone="green"
            />
            <StatCard
              label="รายได้เดือนนี้"
              value={m ? baht(m.revenueThisMonth) : "—"}
              hint={m ? `วันนี้ ${baht(m.revenueToday)}` : undefined}
              icon={Wallet}
              tone="gold"
              href="/admin/payments"
            />
            <StatCard
              label="คำถามที่ตอบเดือนนี้"
              value={m ? num(m.answersThisMonth) : "—"}
              hint={stats ? `เรียก AI ${num(stats.ai.requestsThisMonth)} ครั้ง` : undefined}
              icon={MessagesSquare}
              tone="blue"
              href="/admin/readings"
            />
            <StatCard
              label="ต้นทุน AI เดือนนี้"
              value={m ? baht(m.aiCostThisMonthThb) : "—"}
              hint={perAnswer != null ? `เฉลี่ย ${baht(perAnswer)} ต่อคำตอบ` : undefined}
              icon={Cpu}
              tone="violet"
              href="/admin/costs"
            />
            <StatCard
              label="รายได้ − ต้นทุน AI"
              value={profit != null ? baht(profit) : "—"}
              hint="เดือนนี้ ยังไม่หักค่าเซิร์ฟเวอร์"
              icon={TrendingUp}
              tone={profit != null && profit < 0 ? "danger" : "green"}
            />
            <StatCard
              label="คำขอ AI วันนี้"
              value={stats ? num(stats.ai.requestsToday) : "—"}
              hint={stats ? (stats.ai.errorsToday > 0 ? `ล้มเหลว ${num(stats.ai.errorsToday)} ครั้ง` : "ไม่มีล้มเหลว") : undefined}
              icon={Activity}
              tone={stats && stats.ai.errorsToday > 0 ? "danger" : "default"}
              href="/admin/usage"
            />
            <StatCard
              label="สลิปรอตรวจ"
              value={stats ? num(stats.payments.pending) : "—"}
              hint={stats && (stats.payments.pendingOverdue ?? 0) > 0 ? `ค้างเกิน 48 ชม. ${num(stats.payments.pendingOverdue ?? 0)}` : "ปกติ"}
              icon={ReceiptText}
              tone={stats && (stats.payments.pendingOverdue ?? 0) > 0 ? "danger" : "default"}
              href="/admin/payments"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle icon={ArrowRight} title="ทางลัด" description="หน้าที่ทีมเปิดบ่อย" />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SHORTCUTS.map((href) => ADMIN_NAV.find((n) => n.href === href))
                  .filter((n): n is (typeof ADMIN_NAV)[number] => Boolean(n))
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex min-h-11 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5 text-xs text-[var(--muted)] transition hover:border-[var(--primary)]/45 hover:bg-[var(--primary)]/8 hover:text-[var(--foreground)]"
                    >
                      <item.icon size={16} className="shrink-0 text-[var(--primary)]" aria-hidden />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  ))}
              </div>
            </Card>

            <Card>
              <CardTitle icon={Users} title="ผู้ใช้" tone="green" />
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-3)]" aria-hidden>
                <div className="bg-[var(--secondary-active)]" style={{ width: `${proShare}%` }} />
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                <UserRow dot="bg-[var(--secondary-active)]" label="จ่ายเงิน / Pro" value={stats?.users.pro} />
                <UserRow dot="bg-[var(--surface-3)]" label="Free" value={stats ? free : undefined} />
                <UserRow dot="bg-[var(--primary)]" label="ใช้งานได้ (Active)" value={stats?.users.active} />
                <UserRow
                  dot="bg-[var(--danger)]"
                  label="ถูกระงับ"
                  value={stats ? stats.users.total - stats.users.active : undefined}
                />
              </ul>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle
                icon={Clock}
                title="กิจกรรมแอดมินล่าสุด"
                action={
                  <Link href="/admin/audit-logs" className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
                    ดูทั้งหมด <ArrowRight size={13} aria-hidden />
                  </Link>
                }
              />
              <ul className="mt-3 divide-y divide-[var(--border)]/60">
                {stats && stats.recentAudit.length === 0 && <li className="py-3 text-xs text-[var(--muted)]">ยังไม่มีกิจกรรม</li>}
                {stats?.recentAudit.map((log) => {
                  const d = describeAction(log.action);
                  return (
                    <li key={log.id} className="flex items-center gap-3 py-2.5">
                      <IconTile icon={d.icon} tone={d.tone} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--foreground)]">{d.label}</span>
                        <span className="block truncate text-[11px] text-[var(--muted-2)]">
                          {log.admin.name ?? log.admin.email} · {log.action}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted-2)]">{time(log.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card>
              <CardTitle icon={ShieldCheck} title="สถานะระบบ" tone="green" />
              {ops ? (
                <ul className="mt-3 space-y-1.5">
                  <OpsRow
                    icon={Database}
                    label="ฐานข้อมูล"
                    state={ops.database.connected ? "ok" : "bad"}
                    note={ops.database.connected ? `${ops.database.latencyMs ?? "—"} ms` : "เชื่อมต่อไม่ได้"}
                  />
                  <OpsRow
                    icon={HardDriveUpload}
                    label="อัปโหลดสลิป"
                    state={ops.blobConfigured ? "ok" : "bad"}
                    note={ops.blobConfigured ? "พร้อม" : "ลูกค้าส่งสลิปไม่ได้"}
                  />
                  <OpsRow icon={Mail} label="อีเมล" state={ops.emailConfigured ? "ok" : "bad"} note={ops.emailConfigured ? "พร้อม" : "ยังไม่ตั้ง"} />
                  <OpsRow
                    icon={Bell}
                    label="แจ้งเตือนมือถือ"
                    state={ops.vapidConfigured ? "ok" : "warn"}
                    note={ops.vapidConfigured ? "พร้อม" : "ยังไม่ตั้ง (ไม่บังคับ)"}
                  />
                  <OpsRow
                    icon={Timer}
                    label="กันยิงถี่"
                    state={ops.rateLimitBackend === "upstash" ? "ok" : "warn"}
                    note={ops.rateLimitBackend === "upstash" ? "Upstash" : "ในเครื่อง — ใช้ได้กับเซิร์ฟเวอร์เดียว"}
                  />
                  <OpsRow icon={Clock} label="งานตั้งเวลา" state={ops.cronSecretSet ? "ok" : "bad"} note={ops.cronSecretSet ? "พร้อม" : "ยังไม่ตั้ง"} />
                  <OpsRow
                    icon={KeyRound}
                    label="เข้ารหัส key AI"
                    state={ops.aiSecretEncConfigured ? "ok" : "bad"}
                    note={ops.aiSecretEncConfigured ? "พร้อม" : "ยังไม่ตั้ง"}
                  />
                </ul>
              ) : (
                <p className="mt-3 text-xs text-[var(--muted)]">กำลังตรวจ…</p>
              )}
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <AdminPushEnable />
              </div>
            </Card>
          </div>
        </>
      )}
    </AdminPage>
  );
}

function UserRow({ dot, label, value }: { dot: string; label: string; value?: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[var(--muted)]">
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </span>
      <span className="font-medium tabular-nums text-[var(--foreground)]">{value != null ? num(value) : "—"}</span>
    </li>
  );
}

function OpsRow({
  icon: Icon,
  label,
  state,
  note,
}: {
  icon: LucideIcon;
  label: string;
  state: "ok" | "warn" | "bad";
  note: string;
}) {
  const StateIcon = state === "ok" ? CheckCircle2 : state === "warn" ? CircleAlert : XCircle;
  const color =
    state === "ok" ? "text-[var(--secondary-active)]" : state === "warn" ? "text-[var(--primary)]" : "text-[var(--danger)]";
  return (
    <li className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <Icon size={15} className="shrink-0 text-[var(--muted-2)]" aria-hidden />
      <span className="min-w-0 flex-1 text-xs text-[var(--foreground)]">{label}</span>
      <span className={`flex shrink-0 items-center gap-1 text-[11px] ${color}`}>
        <StateIcon size={13} aria-hidden />
        {note}
      </span>
    </li>
  );
}
