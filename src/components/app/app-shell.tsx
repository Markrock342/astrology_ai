"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { APP_NAME_TH } from "@/config/constants";
import { SettingsPopover } from "./settings-popover";
import { MOCK_THREADS, MOCK_USER, NATAL_CATEGORIES } from "./nav-data";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside
        className={`${
          collapsed ? "w-16" : "w-72"
        } relative z-30 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-300 ease-[var(--ease-out-quart)]`}
      >
        {/* Collapsed rail (icons + profile stay visible), cross-fades in.
            No clipping here so the settings popover can overflow past the rail. */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            collapsed ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <CollapsedRail
            activeCat={activeCat}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            onCloseSettings={() => setSettingsOpen(false)}
            onExpand={() => setCollapsed(false)}
          />
        </div>

        {/* Full panel — clipped to the aside width so its fixed w-72 layout
            never squishes; fades out when collapsed. */}
        <div
          className={`absolute inset-0 overflow-hidden transition-opacity duration-200 ${
            collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
        <div className="flex h-full w-72 flex-col">
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
        <div className="flex flex-col gap-1 px-3 pt-4">
          <Link
            href="/dashboard"
            className="press-scale flex items-center gap-2.5 rounded-full border border-[var(--secondary)]/45 bg-[var(--secondary)]/10 px-3.5 py-2.5 text-sm font-semibold text-[var(--secondary-active)] transition hover:bg-[var(--secondary)]/15"
          >
            <CirclePlusIcon /> เริ่มสนทนาใหม่
          </Link>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <SearchIcon /> ค้นหา
          </button>
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--foreground)]">
                <AvatarIcon />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium text-[var(--foreground)]">{MOCK_USER.name}</p>
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
        </div>
        </div>
      </aside>

      {/* Main */}
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/**
 * Narrow icon rail shown when the sidebar is collapsed — keeps category icons,
 * new-chat, and the user profile reachable without expanding.
 */
function CollapsedRail({
  activeCat,
  settingsOpen,
  onToggleSettings,
  onCloseSettings,
  onExpand,
}: {
  activeCat: string | null;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onExpand: () => void;
}) {
  return (
    <div className="flex h-full w-16 flex-col items-center py-4">
      {/* Expand */}
      <button
        type="button"
        onClick={onExpand}
        className="press-scale rounded-md p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        aria-label="เปิดแถบข้าง"
        title="เปิดแถบข้าง"
      >
        <CollapseIcon />
      </button>

      {/* New chat */}
      <Link
        href="/dashboard"
        className="press-scale mt-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary-active)] text-[var(--secondary-foreground)] transition hover:brightness-110"
        aria-label="เริ่มสนทนาใหม่"
        title="เริ่มสนทนาใหม่"
      >
        <PlusIcon />
      </Link>

      {/* Category icons */}
      <nav className="mt-4 flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {NATAL_CATEGORIES.map((cat) => {
          const active = activeCat === cat.slug;
          return (
            <Link
              key={cat.slug}
              href={`/dashboard?cat=${cat.slug}`}
              title={cat.label}
              aria-label={cat.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                active
                  ? "bg-[var(--surface-3)] text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
            >
              <CategoryIcon slug={cat.slug} />
            </Link>
          );
        })}
      </nav>

      {/* Profile + settings */}
      <div className="relative mt-2 flex flex-col items-center gap-1">
        {settingsOpen && <SettingsPopover onClose={onCloseSettings} />}
        <button
          type="button"
          onClick={onToggleSettings}
          className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
          aria-label="ตั้งค่า"
          title="ตั้งค่า"
        >
          <GearIcon />
        </button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--foreground)]"
          title={MOCK_USER.name}
        >
          <AvatarIcon />
        </div>
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
/** Filled turquoise circle with a white plus — matches the design's "เริ่มสนทนาใหม่". */
function CirclePlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="var(--secondary-active)" />
      <path d="M12 8v8M8 12h8" stroke="var(--secondary-foreground)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
/** Outlined person-in-circle avatar (design shows an icon, not initials). */
function AvatarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 20c.7-3.4 3.3-5 6.5-5s5.8 1.6 6.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6" y="8" width="4.5" height="8" rx="1" fill="currentColor" />
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
    case "career":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" {...stroke} />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...stroke} />
        </svg>
      );
    case "finance":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M12 7.5v9M14 9.7c-.6-.7-1.4-1-2.2-1-1.1 0-2 .6-2 1.6 0 2 4.4 1.1 4.4 3.2 0 1-.9 1.7-2.2 1.7-.9 0-1.7-.4-2.2-1.1" {...stroke} />
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
          <path d="M12 21s-6-5.1-6-10a6 6 0 1 1 12 0c0 4.9-6 10-6 10z" {...stroke} />
          <circle cx="12" cy="11" r="2.3" {...stroke} />
        </svg>
      );
    case "fortune":
      return (
        <svg {...common}>
          <path d="M12 2.5c.7 4.9 1.9 6.1 6.8 6.8-4.9.7-6.1 1.9-6.8 6.8-.7-4.9-1.9-6.1-6.8-6.8 4.9-.7 6.1-1.9 6.8-6.8z" {...stroke} />
          <path d="M18.5 15.5c.3 1.9.8 2.4 2.7 2.7-1.9.3-2.4.8-2.7 2.7-.3-1.9-.8-2.4-2.7-2.7 1.9-.3 2.4-.8 2.7-2.7z" {...stroke} />
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
