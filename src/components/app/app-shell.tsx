"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandLockup, BrandMark } from "@/components/brand-logo";
import { SettingsPopover, type SettingsModal } from "./settings-popover";
import {
  CancelMembershipModal,
  ChangePasswordModal,
  RenameModal,
} from "./settings-modals";
import { CategoryIcon } from "./category-icon";
import {
  CollapseSidebarIcon,
  ExpandSidebarIcon,
  LockIcon,
  MenuIcon,
  MoonIcon,
  NewChatIcon,
  SearchIcon,
  SunIcon,
  TransitIcon,
} from "./sidebar-icons";
import { useAppData, isCategoryLocked } from "./app-data-provider";
import { VerifyEmailBanner } from "./verify-email-banner";
import { PendingPaymentBanner } from "./pending-payment-banner";
import { SiteAnnouncementBanner } from "@/components/cms/site-announcement-banner";
import { UserAvatar } from "./user-avatar";
import { useTheme } from "@/components/theme-provider";
import { TransitFormModal } from "./transit-form-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // Two-phase mobile drawer so it can animate on both enter and exit:
  // `mobileRender` keeps it mounted, `mobileShown` drives the slide/fade.
  const [mobileRender, setMobileRender] = useState(false);
  const [mobileShown, setMobileShown] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [transitOpen, setTransitOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<SettingsModal>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");
  const activeThread = searchParams.get("thread");
  const { theme, toggleTheme } = useTheme();

  const {
    user,
    refresh,
    filteredCategories,
    filteredNatalThreads,
    filteredTransitThreads,
    searchQuery,
    setSearchQuery,
    loading,
    loadError,
  } = useAppData();

  const displayName = user?.name ?? (loading ? "…" : loadError ? "—" : "ผู้ใช้");
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const planLabel = isStaff
    ? user?.role === "SUPER_ADMIN"
      ? "Super Admin"
      : "Admin"
    : user?.plan === "PRO"
      ? "Pro"
      : "Free";
  const themeLabel = theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด";

  const openMobile = useCallback(() => {
    setMobileRender(true);
    // Mount first, then flip to shown on the next frame so the transition runs.
    requestAnimationFrame(() => setMobileShown(true));
  }, []);

  const closeMobile = useCallback(() => {
    setMobileShown(false);
    // Unmount after the exit transition. The global reduced-motion rule
    // collapses the transition to ~0ms, so this is effectively instant then.
    window.setTimeout(() => setMobileRender(false), 240);
  }, []);

  useEffect(() => {
    if (!mobileRender) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileRender, closeMobile]);

  // Modal state lives here (not in the popover) so it survives the popover
  // closing/unmounting and never duplicates across sidebar variants.
  function openModal(m: SettingsModal) {
    setActiveModal(m);
    setSettingsOpen(false);
    closeMobile();
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <Link href="/dashboard" className="min-w-0" onClick={closeMobile}>
          <BrandLockup markSize={28} />
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
          <CollapseSidebarIcon />
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
          <NewChatIcon /> เริ่มสนทนาใหม่
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <span className="text-[var(--primary)]">
            <SearchIcon />
          </span>
          ค้นหา
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
                  <span className="text-[var(--primary)]">
                    <CategoryIcon slug={cat.slug} />
                  </span>
                  {cat.label}
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

        <SidebarDivider />

        <SectionLabel>ประวัติแชท</SectionLabel>
        {loadError ? (
          <div className="px-3 py-2 text-xs text-[var(--danger)]">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => refresh()}
              className="mt-1 text-[var(--primary)] underline"
            >
              ลองใหม่
            </button>
          </div>
        ) : null}
        <nav className="flex flex-col gap-0.5">
          {filteredNatalThreads.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted-2)]">
              {loading ? "กำลังโหลด…" : "ยังไม่มีประวัติแชท"}
            </p>
          ) : (
            filteredNatalThreads.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?thread=${t.id}${t.categorySlug ? `&cat=${t.categorySlug}` : ""}`}
                onClick={closeMobile}
                className={`flex items-center gap-2 truncate rounded-lg px-3 py-2 text-xs transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] ${
                  activeThread === t.id
                    ? "bg-[var(--surface-3)] text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {t.categorySlug ? (
                  <span className="shrink-0 text-[var(--primary)]">
                    <CategoryIcon slug={t.categorySlug} />
                  </span>
                ) : null}
                {t.title}
              </Link>
            ))
          )}
        </nav>

        <SidebarDivider />

        <SectionLabel>ดวงจร</SectionLabel>
        <button
          type="button"
          onClick={() => {
            setTransitOpen(true);
            closeMobile();
          }}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--primary)] transition hover:bg-[var(--surface-2)]"
        >
          <TransitIcon />
          เริ่มดวงจรใหม่
        </button>
        <nav className="flex flex-col gap-0.5">
          {filteredTransitThreads.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted-2)]">
              {loading ? "กำลังโหลด…" : "ยังไม่มีดวงจร"}
            </p>
          ) : (
            filteredTransitThreads.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?thread=${t.id}${t.categorySlug ? `&cat=${t.categorySlug}` : ""}`}
                onClick={closeMobile}
                className={`flex items-center gap-2 truncate rounded-lg px-3 py-2 text-xs transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] ${
                  activeThread === t.id
                    ? "bg-[var(--surface-3)] text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }`}
              >
                <span className="shrink-0 text-[var(--primary)]">
                  <TransitIcon />
                </span>
                {t.title}
              </Link>
            ))
          )}
        </nav>
      </div>

      <div className="relative border-t border-[var(--border)] p-3">
        {settingsOpen && !collapsed && (
          <SettingsPopover
            onClose={() => setSettingsOpen(false)}
            onOpenModal={openModal}
            anchorRef={profileBtnRef}
          />
        )}
        <div className="flex items-center gap-1 rounded-xl px-1 py-1">
          <button
            ref={profileBtnRef}
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface-2)]"
            aria-label="เปิดการตั้งค่า"
            aria-expanded={settingsOpen}
            title="การตั้งค่า"
          >
            <UserAvatar name={displayName} image={user?.image} size={36} />
            <div className="min-w-0 leading-tight">
              <p className="max-w-[120px] truncate text-sm font-medium text-[var(--foreground)]">
                {displayName}
              </p>
              <p className="text-[11px] text-[var(--muted-2)]">{planLabel}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="shrink-0 rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Mobile drawer: overlay fades, panel slides. transform/opacity only. */}
      {mobileRender && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ease-[var(--ease-out-quart)] ${
              mobileShown ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMobile}
            aria-label="ปิดเมนู"
          />
          <aside
            className={`relative z-50 flex h-full w-[86vw] max-w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-[240ms] ease-[var(--ease-out-quart)] will-change-transform ${
              mobileShown ? "translate-x-0" : "-translate-x-full"
            }`}
          >
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
            onToggleTheme={toggleTheme}
            theme={theme}
            themeLabel={themeLabel}
            displayName={displayName}
            image={user?.image}
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

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — gives the menu a home + brand context without a
            floating button overlapping page content. */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 md:hidden">
          <button
            type="button"
            onClick={openMobile}
            className="press-scale rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            aria-label="เปิดเมนู"
          >
            <MenuIcon />
          </button>
          <Link href="/dashboard" className="min-w-0">
            <BrandLockup markSize={26} showTagline={false} />
          </Link>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <SiteAnnouncementBanner />
          <PendingPaymentBanner />
          <VerifyEmailBanner />
          {children}
        </div>
      </div>

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
      {transitOpen && <TransitFormModal onClose={() => setTransitOpen(false)} />}
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
  onToggleTheme,
  theme,
  themeLabel,
  displayName,
  image,
}: {
  activeCat: string | null;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onExpand: () => void;
  onOpenModal: (m: SettingsModal) => void;
  onToggleTheme: () => void;
  theme: "dark" | "light";
  themeLabel: string;
  displayName: string;
  image?: string | null;
}) {
  const { filteredCategories } = useAppData();
  const railBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-full w-16 flex-col items-center py-3">
      <Link
        href="/dashboard"
        className="press-scale mb-1 rounded-lg p-1 transition hover:bg-[var(--surface-2)]"
        aria-label="horasard"
        title="horasard"
      >
        <BrandMark size={32} />
      </Link>

      <button
        type="button"
        onClick={onExpand}
        className="press-scale rounded-md p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        aria-label="เปิดแถบข้าง"
        title="เปิดแถบข้าง"
      >
        <ExpandSidebarIcon />
      </button>

      <Link
        href="/dashboard"
        className="press-scale mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary-active)] text-[var(--secondary-foreground)] transition hover:brightness-110"
        aria-label="เริ่มสนทนาใหม่"
        title="เริ่มสนทนาใหม่"
      >
        <NewChatIcon size={22} />
      </Link>

      <nav className="mt-3 flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
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
                  ? "bg-[var(--surface-3)] text-[var(--primary)]"
                  : "text-[var(--primary)]/75 hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
              }`}
            >
              <CategoryIcon slug={cat.slug} size={20} />
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
          type="button"
          onClick={onToggleTheme}
          className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
          aria-label={themeLabel}
          title={themeLabel}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          ref={railBtnRef}
          type="button"
          onClick={onToggleSettings}
          className="rounded-full p-0.5 transition hover:ring-2 hover:ring-[var(--primary)]/40"
          aria-label="เปิดการตั้งค่า"
          aria-expanded={settingsOpen}
          title="การตั้งค่า"
        >
          <UserAvatar name={displayName} image={image} size={36} />
        </button>
      </div>
    </div>
  );
}

function SidebarDivider() {
  return <div className="my-4 border-t border-[var(--border)]" aria-hidden />;
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
