"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { APP_NAME_TH } from "@/config/constants";
import { SettingsPopover, type SettingsModal } from "./settings-popover";
import {
  CancelMembershipModal,
  ChangePasswordModal,
  RenameModal,
} from "./settings-modals";
import { CategoryIcon } from "./category-icon";
import { useAppData, isCategoryLocked } from "./app-data-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<SettingsModal>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");
  const activeThread = searchParams.get("thread");

  const {
    user,
    refresh,
    filteredCategories,
    filteredThreads,
    searchQuery,
    setSearchQuery,
    loading,
  } = useAppData();

  const displayName = user?.name ?? (loading ? "…" : "ผู้ใช้");
  const planLabel = user?.plan === "PRO" ? "Pro" : "Free";

  function closeMobile() {
    setMobileOpen(false);
  }

  // Modal state lives here (not in the popover) so it survives the popover
  // closing/unmounting and never duplicates across sidebar variants.
  function openModal(m: SettingsModal) {
    setActiveModal(m);
    setSettingsOpen(false);
    setMobileOpen(false);
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={closeMobile}>
          <BrandMark size={30} />
          <span className="text-sm font-semibold text-[var(--primary)]">{APP_NAME_TH}</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            setCollapsed(true);
            closeMobile();
          }}
          className="hidden rounded-md p-1.5 text-[var(--muted-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] md:inline-flex"
          aria-label="พับแถบข้าง"
        >
          <CollapseIcon />
        </button>
        <button
          type="button"
          onClick={closeMobile}
          className="rounded-md p-1.5 text-[var(--muted-2)] hover:text-[var(--foreground)] md:hidden"
          aria-label="ปิดเมนู"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-1 px-3 pt-4">
        <Link
          href="/dashboard"
          onClick={closeMobile}
          className="press-scale flex items-center gap-2.5 rounded-full border border-[var(--secondary)]/45 bg-[var(--secondary)]/10 px-3.5 py-2.5 text-sm font-semibold text-[var(--secondary-active)] transition hover:bg-[var(--secondary)]/15"
        >
          <CirclePlusIcon /> เริ่มสนทนาใหม่
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <SearchIcon /> ค้นหา
        </button>
        {searchOpen && (
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาหมวดหรือประวัติ…"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            autoFocus
          />
        )}
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-3 pb-2">
        <SectionLabel>พื้นดวงเดิม</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {filteredCategories.map((cat) => {
            const locked = isCategoryLocked(cat, user?.plan ?? "FREE");
            const active = activeCat === cat.slug;
            return (
              <Link
                key={cat.slug}
                href={`/dashboard?cat=${cat.slug}`}
                onClick={closeMobile}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-[var(--surface-3)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                } ${locked ? "opacity-80" : ""}`}
              >
                <span className="flex items-center gap-2.5">
                  <CategoryIcon slug={cat.slug} /> {cat.label}
                </span>
                {locked ? (
                  <LockIcon />
                ) : cat.tier === "FREE" ? (
                  <span className="rounded px-1.5 py-0.5 text-[10px] text-[var(--secondary-active)]">
                    Free
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <SectionLabel className="mt-5">ประวัติสนทนา</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {filteredThreads.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted-2)]">
              {loading ? "กำลังโหลด…" : "ยังไม่มีประวัติ"}
            </p>
          ) : (
            filteredThreads.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?thread=${t.id}${t.categorySlug ? `&cat=${t.categorySlug}` : ""}`}
                onClick={closeMobile}
                className={`truncate rounded-lg px-3 py-2 text-xs transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] ${
                  activeThread === t.id
                    ? "bg-[var(--surface-3)] text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {t.title}
              </Link>
            ))
          )}
        </nav>

        <SectionLabel className="mt-5">ดวงจร</SectionLabel>
        <p className="px-3 py-2 text-xs text-[var(--muted-2)]">
          โหมดดวงจร (Pro) — รอ PM ยืนยันสโคป
        </p>
      </div>

      <div className="relative border-t border-[var(--border)] p-3">
        {settingsOpen && !collapsed && (
          <SettingsPopover
            onClose={() => setSettingsOpen(false)}
            onOpenModal={openModal}
            anchorRef={settingsBtnRef}
          />
        )}
        <div className="flex items-center justify-between rounded-xl px-2 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--foreground)]">
              <AvatarIcon />
            </div>
            <div className="leading-tight">
              <p className="max-w-[140px] truncate text-sm font-medium text-[var(--foreground)]">
                {displayName}
              </p>
              <p className="text-[11px] text-[var(--muted-2)]">{planLabel}</p>
            </div>
          </div>
          <button
            ref={settingsBtnRef}
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
            aria-label="ตั้งค่า"
          >
            <GearIcon />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--muted)] md:hidden"
        aria-label="เปิดเมนู"
      >
        <MenuIcon />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={closeMobile}
            aria-label="ปิดเมนู"
          />
          <aside className="relative z-50 flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-72"
        } relative z-30 hidden shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-300 ease-[var(--ease-out-quart)] md:flex md:flex-col`}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            collapsed ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <CollapsedRail
            activeCat={activeCat}
            settingsOpen={settingsOpen && collapsed}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            onCloseSettings={() => setSettingsOpen(false)}
            onExpand={() => setCollapsed(false)}
            onOpenModal={openModal}
            displayName={displayName}
          />
        </div>

        <div
          className={`absolute inset-0 overflow-hidden transition-opacity duration-200 ${
            collapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex h-full w-72 flex-col">{sidebarContent}</div>
        </div>
      </aside>

      <div className="relative flex flex-1 flex-col">{children}</div>

      {/* Settings modals — rendered once here so they survive the popover
          closing and never duplicate across sidebar variants. */}
      {activeModal === "rename" && (
        <RenameModal
          currentName={displayName}
          onClose={() => setActiveModal(null)}
          onSaved={() => refresh()}
        />
      )}
      {activeModal === "password" && (
        <ChangePasswordModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "cancel" && (
        <CancelMembershipModal
          isPro={user?.plan === "PRO"}
          onClose={() => setActiveModal(null)}
          onCancelled={() => refresh()}
        />
      )}
    </div>
  );
}

function CollapsedRail({
  activeCat,
  settingsOpen,
  onToggleSettings,
  onCloseSettings,
  onExpand,
  onOpenModal,
  displayName,
}: {
  activeCat: string | null;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onExpand: () => void;
  onOpenModal: (m: SettingsModal) => void;
  displayName: string;
}) {
  const { filteredCategories } = useAppData();
  const railBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-full w-16 flex-col items-center py-4">
      <button
        type="button"
        onClick={onExpand}
        className="press-scale rounded-md p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        aria-label="เปิดแถบข้าง"
        title="เปิดแถบข้าง"
      >
        <CollapseIcon />
      </button>

      <Link
        href="/dashboard"
        className="press-scale mt-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary-active)] text-[var(--secondary-foreground)] transition hover:brightness-110"
        aria-label="เริ่มสนทนาใหม่"
        title="เริ่มสนทนาใหม่"
      >
        <PlusIcon />
      </Link>

      <nav className="mt-4 flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {filteredCategories.map((cat) => {
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

      <div className="relative mt-2 flex flex-col items-center gap-1">
        {settingsOpen && (
          <SettingsPopover
            onClose={onCloseSettings}
            onOpenModal={onOpenModal}
            anchorRef={railBtnRef}
          />
        )}
        <button
          ref={railBtnRef}
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
          title={displayName}
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

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function CirclePlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="var(--secondary-active)" />
      <path d="M12 8v8M8 12h8" stroke="var(--secondary-foreground)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
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
