"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-logo";
import { APP_NAME_TH } from "@/config/constants";
import { FEATURES } from "@/config/features";
import { groupedAdminNav } from "@/config/admin-nav";
import { Badge } from "./ui";
import { ProviderAlertBanner } from "./provider-alert-banner";

export function AdminShell({
  children,
  userName,
  userRole,
  maintenanceOn,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userRole?: string | null;
  maintenanceOn?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = groupedAdminNav(FEATURES.aiAdmin);

  function isActive(href: string) {
    if (href === "/admin/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebar = (
    <nav className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-2)]">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--surface-3)] font-medium text-[var(--primary)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        <div className="border-b border-[var(--border)] px-4 py-4">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <BrandMark size={28} />
            <div>
              <p className="text-xs font-semibold text-[var(--primary)]">ระบบจัดการ</p>
              <p className="text-[10px] text-[var(--muted-2)]">{APP_NAME_TH}</p>
            </div>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{sidebar}</div>
        <div className="border-t border-[var(--border)] p-4">
          <Link
            href="/dashboard"
            className="text-xs text-[var(--muted)] transition hover:text-[var(--secondary-active)]"
          >
            ← กลับแอปผู้ใช้
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="ปิดเมนู"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-72 flex-col bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
              <span className="text-sm font-semibold text-[var(--primary)]">ระบบจัดการ</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-[var(--muted)]"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{sidebar}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <ProviderAlertBanner />
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted)] lg:hidden"
              aria-label="เปิดเมนู"
            >
              ☰
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-2)]">
                ระบบจัดการ
              </p>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {userName ?? "แอดมิน"}
                {userRole && (
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    ({userRole})
                  </span>
                )}
              </p>
            </div>
            {maintenanceOn && <Badge tone="red">ปิดระบบชั่วคราว</Badge>}
          </div>
          <Link
            href="/dashboard"
            className="hidden rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)] sm:inline-flex"
          >
            กลับแอป
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto bg-[var(--background)]">{children}</main>
      </div>
    </div>
  );
}
