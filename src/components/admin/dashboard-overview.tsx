"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminDashboardSkeleton } from "@/components/app/content-skeleton";
import { AdminPage, Badge, Card, PageHeader, StatCard, adminFetch } from "./ui";
import { AdminPushEnable } from "./admin-push-enable";

type DashboardStats = {
  users: { total: number; active: number; pro: number; newThisWeek: number };
  ai: { requestsToday: number; errorsToday: number; requestsThisMonth: number };
  credits: { usedThisMonth: number; totalBalance: number };
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
  nodeEnv: string;
  rateLimitBackend: "upstash" | "memory";
  upstashConfigured: boolean;
  blobConfigured: boolean;
  emailConfigured: boolean;
  cronSecretSet: boolean;
  aiSecretEncConfigured: boolean;
  vapidConfigured: boolean;
};

export function DashboardOverview({
  initialStats,
}: {
  initialStats?: DashboardStats | null;
}) {
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

  return (
    <AdminPage>
      <PageHeader title="ภาพรวม" description="สรุปสถานะระบบแบบเรียลไทม์" />

      <div className="mb-4">
        <AdminPushEnable />
      </div>

      {ops ? (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Ops health
          </h2>
          <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <OpsFlag
              label={`Rate-limit: ${ops.rateLimitBackend}`}
              ok={ops.rateLimitBackend === "upstash"}
              warn={
                ops.nodeEnv === "production" && ops.rateLimitBackend === "memory"
                  ? "production ยังเป็น memory — ตั้ง UPSTASH_*"
                  : undefined
              }
            />
            <OpsFlag label="Blob สลิป" ok={ops.blobConfigured} />
            <OpsFlag label="Resend email" ok={ops.emailConfigured} />
            <OpsFlag label="CRON_SECRET" ok={ops.cronSecretSet} />
            <OpsFlag label="AI_SECRET_ENC_KEY" ok={ops.aiSecretEncConfigured} />
            <OpsFlag label="VAPID push" ok={ops.vapidConfigured} />
          </ul>
        </Card>
      ) : null}

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {loading && !stats ? (
        <AdminDashboardSkeleton />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="ผู้ใช้ทั้งหมด" value={stats?.users.total ?? "—"} tone="gold" />
        <StatCard
          label="สมาชิก Pro"
          value={stats?.users.pro ?? "—"}
          hint={`ใหม่สัปดาห์นี้ ${stats?.users.newThisWeek ?? "—"} คน`}
          tone="green"
        />
        <StatCard
          label="คำขอ AI วันนี้"
          value={stats?.ai.requestsToday ?? "—"}
          hint={
            stats && stats.ai.errorsToday > 0
              ? `ล้มเหลว ${stats.ai.errorsToday} ครั้ง`
              : "เดือนนี้ " + (stats?.ai.requestsThisMonth ?? "—") + " ครั้ง"
          }
          tone={stats && stats.ai.errorsToday > 0 ? "danger" : "default"}
        />
        <StatCard
          label="เครดิตที่ใช้ (เดือนนี้)"
          value={stats?.credits.usedThisMonth ?? "—"}
          hint={`คงเหลือรวมทั้งระบบ ${stats?.credits.totalBalance ?? "—"}`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">ทางลัด</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <QuickLink href="/admin/users" label="จัดการผู้ใช้" />
            <QuickLink href="/admin/categories" label="หมวดดูดวง" />
            <QuickLink href="/admin/packages" label="แพ็กเกจ & โควตา" />
            <QuickLink href="/admin/settings" label="ข้อความเว็บ" />
            <QuickLink href="/admin/payments" label="ตรวจการโอนเงิน" />
            <QuickLink href="/admin/prompts" label="บุคลิก AI" />
            <QuickLink href="/admin/ai-configs" label="AI Models" />
            <QuickLink href="/admin/audit-logs" label="Audit Logs" />
          </div>
          {stats && stats.payments.pending > 0 && (
            <p
              className={`mt-4 text-xs ${
                (stats.payments.pendingOverdue ?? 0) > 0
                  ? "text-[var(--danger)]"
                  : "text-[var(--primary)]"
              }`}
            >
              มีคำขอชำระเงินรออนุมัติ {stats.payments.pending} รายการ
              {(stats.payments.pendingOverdue ?? 0) > 0
                ? ` · ค้างเกิน 48 ชม. ${stats.payments.pendingOverdue} รายการ`
                : ""}{" "}
              —{" "}
              <Link href="/admin/payments" className="underline">
                ไปตรวจสอบ
              </Link>
            </p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            สถานะผู้ใช้
          </h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--muted)]">
            <li className="flex justify-between">
              <span>บัญชีที่ใช้งานได้ (Active)</span>
              <span className="text-[var(--secondary-active)]">
                {stats?.users.active ?? "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>ถูกระงับ</span>
              <span className="text-[var(--danger)]">
                {stats ? stats.users.total - stats.users.active : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Free</span>
              <span>{stats ? stats.users.total - stats.users.pro : "—"}</span>
            </li>
            <li className="flex justify-between">
              <span>Pro</span>
              <span className="text-[var(--primary)]">{stats?.users.pro ?? "—"}</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            กิจกรรมแอดมินล่าสุด
          </h2>
          <Link
            href="/admin/audit-logs"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ดูทั้งหมด →
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {stats && stats.recentAudit.length === 0 && (
            <li className="text-xs text-[var(--muted)]">ยังไม่มีกิจกรรม</li>
          )}
          {stats?.recentAudit.map((log) => (
            <li
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]/50 py-2 text-xs"
            >
              <span className="flex items-center gap-2">
                <Badge tone="gold">{log.action}</Badge>
                <span className="text-[var(--muted)]">
                  {log.admin.name ?? log.admin.email}
                </span>
              </span>
              <span className="text-[var(--muted-2)]">
                {new Date(log.createdAt).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </li>
          ))}
        </ul>
      </Card>
        </>
      )}
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

function OpsFlag({
  label,
  ok,
  warn,
}: {
  label: string;
  ok: boolean;
  warn?: string;
}) {
  return (
    <li className="flex flex-col gap-0.5 rounded-lg border border-[var(--border)] px-3 py-2">
      <span className="flex items-center justify-between gap-2">
        <span className="text-[var(--muted)]">{label}</span>
        <Badge tone={ok ? "green" : "red"}>{ok ? "พร้อม" : "ยังไม่ตั้ง"}</Badge>
      </span>
      {warn ? <span className="text-[var(--danger)]">{warn}</span> : null}
    </li>
  );
}
