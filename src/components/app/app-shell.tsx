"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { APP_NAME_TH } from "@/config/constants";
import { SettingsPopover } from "./settings-popover";
import { MOCK_THREADS, MOCK_USER, NATAL_CATEGORIES } from "./nav-data";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside
        className={`${
          collapsed ? "w-0 -translate-x-full" : "w-72"
        } fixed inset-y-0 left-0 z-30 flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all md:static md:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={30} />
            <span className="text-sm font-semibold text-[var(--primary)]">
              {APP_NAME_TH}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1.5 text-[var(--muted-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] md:inline-flex"
            aria-label="พับแถบข้าง"
          >
            <CollapseIcon />
          </button>
        </div>

        {/* New chat + search */}
        <div className="flex flex-col gap-2 px-4 pt-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--secondary-active)] px-4 py-2.5 text-sm font-semibold text-[var(--secondary-foreground)] transition hover:brightness-110"
          >
            <PlusIcon /> เริ่มสนทนาใหม่
          </Link>
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted-2)]">
            <SearchIcon />
            <input
              placeholder="ค้นหา"
              className="w-full bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-2)] outline-none"
            />
          </div>
        </div>

        {/* Scroll area */}
        <div className="mt-4 flex-1 overflow-y-auto px-3 pb-2">
          <SectionLabel>พื้นดวงเดิม</SectionLabel>
          <nav className="flex flex-col gap-0.5">
            {NATAL_CATEGORIES.map((cat) => {
              const locked = cat.tier === "PRO";
              const active = activeCat === cat.slug;
              return (
                <Link
                  key={cat.slug}
                  href={`/dashboard?cat=${cat.slug}`}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--surface-3)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                  } ${locked ? "opacity-70" : ""}`}
                >
                  <span className="flex items-center gap-2.5">
                    <CategoryIcon slug={cat.slug} /> {cat.label}
                  </span>
                  {locked && <LockIcon />}
                </Link>
              );
            })}
          </nav>

          <SectionLabel className="mt-5">ดวงจร</SectionLabel>
          <nav className="flex flex-col gap-0.5">
            {MOCK_THREADS.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?thread=${t.id}`}
                className="truncate rounded-lg px-3 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                {t.title}
              </Link>
            ))}
          </nav>
        </div>

        {/* User bar + settings */}
        <div className="relative border-t border-[var(--border)] p-3">
          {settingsOpen && (
            <SettingsPopover onClose={() => setSettingsOpen(false)} />
          )}
          <div className="flex items-center justify-between rounded-xl px-2 py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-sm font-semibold text-[var(--foreground)]">
                {MOCK_USER.name.charAt(0).toUpperCase()}
              </div>
              <div className="leading-tight">
                <p className="text-sm text-[var(--foreground)]">{MOCK_USER.name}</p>
                <p className="text-[11px] text-[var(--muted-2)]">
                  {MOCK_USER.tier === "PRO" ? "Pro" : "Pro หรือ Free"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
              aria-label="ตั้งค่า"
            >
              <GearIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="absolute left-3 top-3 z-40 rounded-md bg-[var(--surface-2)] p-2 text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="เปิดแถบข้าง"
          >
            <CollapseIcon />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-2)] ${className}`}
    >
      {children}
    </p>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-[var(--muted-2)]">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function CollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 4v16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function CategoryIcon({ slug }: { slug: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none" } as const;
  const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (slug) {
    case "self":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" {...stroke} />
          <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" {...stroke} />
        </svg>
      );
    case "work":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" {...stroke} />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...stroke} />
        </svg>
      );
    case "finance":
      return (
        <svg {...common}>
          <path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H8m0 0h7" {...stroke} />
        </svg>
      );
    case "love":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.5-7 9-7 9z" {...stroke} />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" {...stroke} />
          <rect x="4" y="4" width="16" height="16" rx="4" {...stroke} />
        </svg>
      );
    case "luck":
      return (
        <svg {...common}>
          <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" {...stroke} />
        </svg>
      );
  }
}
