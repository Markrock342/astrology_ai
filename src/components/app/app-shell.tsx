"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
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
import { ConfirmModal } from "./confirm-modal";
import {
  CollapseSidebarIcon,
  ExpandSidebarIcon,
  LockIcon,
  MenuIcon,
  NewChatIcon,
  SearchIcon,
  TransitIcon,
} from "./sidebar-icons";
import { useAppData, isCategoryLocked } from "./app-data-provider";
import { isPlainLeftClick, useChatNav } from "./chat-nav";
import { VerifyEmailBanner } from "./verify-email-banner";
import { PendingPaymentBanner } from "./pending-payment-banner";
import { SiteAnnouncementBanner } from "@/components/cms/site-announcement-banner";
import { UserAvatar } from "./user-avatar";
import { ThemePicker } from "./theme-picker";
import { TransitFormModal } from "./transit-form-modal";
import {
  clearThreadCache,
  invalidateCachedThread,
  prefetchThread,
} from "./thread-cache";

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
  // Destructive-action confirm (delete one thread / clear all history) uses a
  // styled modal instead of window.confirm.
  const [confirmAction, setConfirmAction] = useState<
    { kind: "delete"; threadId: string } | { kind: "clear-all" } | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  // Separate anchors: sidebarContent mounts in both the mobile drawer and the
  // CSS-hidden desktop aside — one shared ref would point at the hidden button.
  const mobileProfileBtnRef = useRef<HTMLButtonElement>(null);
  const desktopProfileBtnRef = useRef<HTMLButtonElement>(null);
  const closeMobileTimer = useRef<number | null>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  // What had focus before the drawer opened, so we can hand it back on close.
  const focusBeforeDrawer = useRef<HTMLElement | null>(null);
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");
  const activeThread = searchParams.get("thread");
  const chatNav = useChatNav();

  const {
    user,
    refresh,
    removeThreadLocal,
    clearThreadsLocal,
    refreshLight,
    filteredCategories,
    filteredNatalThreads,
    filteredTransitThreads,
    searchQuery,
    setSearchQuery,
    loading,
    loadError,
  } = useAppData();

  function openThread(threadId: string, categorySlug?: string | null) {
    closeMobile();
    void prefetchThread(threadId);
    const cat = categorySlug ? `&cat=${categorySlug}` : "";
    chatNav(`/dashboard?thread=${threadId}${cat}`);
  }

  async function performDeleteThread(threadId: string) {
    // Optimistic: disappear from sidebar immediately.
    removeThreadLocal(threadId);
    invalidateCachedThread(threadId);
    if (activeThread === threadId) {
      chatNav("/dashboard");
    }
    try {
      const res = await fetch(`/api/conversations/${threadId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        window.alert(json?.error?.message ?? "ลบแชทไม่สำเร็จ");
        void refresh();
        return;
      }
      // The active thread was already redirected away above, before the DELETE.
      await refreshLight();
    } catch {
      window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      void refresh();
    }
  }

  async function performClearAll() {
    // Optimistic: empty the sidebar, then leave any open thread.
    clearThreadsLocal();
    // Evict the in-memory thread cache too, or one press of Back restores a
    // "permanently deleted" conversation, messages and all.
    clearThreadCache();
    if (activeThread) chatNav("/dashboard");
    try {
      const res = await fetch("/api/conversations", { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        window.alert(json?.error?.message ?? "ล้างประวัติไม่สำเร็จ");
        void refresh();
        return;
      }
      await refreshLight();
    } catch {
      window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
      void refresh();
    }
  }

  async function runConfirm() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.kind === "delete") {
        await performDeleteThread(confirmAction.threadId);
      } else {
        await performClearAll();
      }
    } finally {
      setConfirmBusy(false);
      setConfirmAction(null);
    }
  }

  function deleteThread(threadId: string) {
    setConfirmAction({ kind: "delete", threadId });
  }

  async function renameThread(threadId: string, currentTitle: string) {
    const next = window.prompt("เปลี่ยนชื่อแชท", currentTitle);
    if (!next?.trim() || next.trim() === currentTitle.trim()) return;
    try {
      const res = await fetch(`/api/conversations/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        window.alert(json?.error?.message ?? "เปลี่ยนชื่อไม่สำเร็จ");
        return;
      }
      await refreshLight();
    } catch {
      window.alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  const displayName = user?.name ?? (loading ? "…" : loadError ? "—" : "ผู้ใช้");
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const planLabel = isStaff
    ? user?.role === "SUPER_ADMIN"
      ? "Super Admin"
      : "Admin"
    : user?.plan === "PRO"
      ? "Pro"
      : "Free";
  const openMobile = useCallback(() => {
    // Cancel a pending unmount — otherwise open-after-close within 240ms
    // gets killed by the previous close timer (feels like taps don't stick).
    if (closeMobileTimer.current != null) {
      window.clearTimeout(closeMobileTimer.current);
      closeMobileTimer.current = null;
    }
    setMobileRender(true);
    // Mount first, then flip to shown on the next frame so the transition runs.
    requestAnimationFrame(() => setMobileShown(true));
  }, []);

  const closeMobile = useCallback(() => {
    setMobileShown(false);
    if (closeMobileTimer.current != null) {
      window.clearTimeout(closeMobileTimer.current);
    }
    // Unmount after the exit transition. The global reduced-motion rule
    // collapses the transition to ~0ms, so this is effectively instant then.
    closeMobileTimer.current = window.setTimeout(() => {
      setMobileRender(false);
      closeMobileTimer.current = null;
    }, 240);
  }, []);

  useEffect(() => {
    return () => {
      if (closeMobileTimer.current != null) {
        window.clearTimeout(closeMobileTimer.current);
      }
    };
  }, []);

  // Edge-swipe: drag in from the left edge to open the drawer, swipe left on the
  // open drawer to close it — the gesture people reach for on a phone. It never
  // calls preventDefault, so vertical scrolling is untouched; it only reads the
  // touch and, once per gesture, decides whether a clear horizontal swipe fired.
  const swipe = useRef<{
    x: number;
    y: number;
    fromEdge: boolean;
    fired: boolean;
  } | null>(null);

  // Plain functions — the React Compiler memoizes them; a manual useCallback
  // here conflicts with it ("existing memoization could not be preserved").
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    swipe.current = {
      x: t.clientX,
      y: t.clientY,
      fromEdge: t.clientX <= 28,
      fired: false,
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = swipe.current;
    const t = e.touches[0];
    if (!s || s.fired || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Ignore anything that is mostly vertical — that is a scroll, not a swipe.
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    s.fired = true;
    if (dx > 0 && s.fromEdge && !mobileShown) openMobile();
    else if (dx < 0 && mobileShown) closeMobile();
  }

  useEffect(() => {
    if (!mobileRender) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileRender, closeMobile]);

  // Move focus INTO the drawer when it opens and hand it back to the trigger when
  // it closes. Without this, a keyboard or screen-reader user's focus stayed on
  // the page behind the overlay — they could tab through content they could not
  // see. (`inert` on the main content, below, keeps focus from escaping.)
  useEffect(() => {
    if (mobileShown) {
      focusBeforeDrawer.current =
        document.activeElement as HTMLElement | null;
      mobileDrawerRef.current
        ?.querySelector<HTMLElement>(
          'a, button, input, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    } else if (focusBeforeDrawer.current) {
      focusBeforeDrawer.current.focus();
      focusBeforeDrawer.current = null;
    }
  }, [mobileShown]);

  // Prevent background scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileShown) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileShown]);

  // Modal state lives here (not in the popover) so it survives the popover
  // closing/unmounting and never duplicates across sidebar variants.
  function openModal(m: SettingsModal) {
    setActiveModal(m);
    setSettingsOpen(false);
    closeMobile();
  }

  // Plain function — React Compiler memoizes; avoid useCallback (eslint preserve-manual-memoization).
  function onSettingsNavigate() {
    setSettingsOpen(false);
    closeMobile();
  }

  function renderProfileFooter(
    anchorRef: RefObject<HTMLButtonElement | null>,
  ) {
    return (
      <div className="relative border-t border-[var(--border)] p-3">
        {settingsOpen && !collapsed && (
          <SettingsPopover
            onClose={() => setSettingsOpen(false)}
            onOpenModal={openModal}
            onNavigate={onSettingsNavigate}
            anchorRef={anchorRef}
          />
        )}
        <div className="flex items-center gap-1 rounded-xl px-1 py-1">
          <button
            ref={anchorRef}
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
          {user != null && (
            <Link
              href="/account"
              onClick={closeMobile}
              className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
              title="ดูเครดิต / แพ็กเกจ"
            >
              เครดิต{" "}
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {user.creditBalance}
              </span>
            </Link>
          )}
          <ThemePicker />
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href="/dashboard"
          className="min-w-0"
          onClick={(e) => {
            if (isPlainLeftClick(e)) {
              e.preventDefault();
              chatNav("/dashboard");
            }
            closeMobile();
          }}
        >
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
                onClick={(e) => {
                  if (isPlainLeftClick(e)) {
                    e.preventDefault();
                    chatNav(`/dashboard?cat=${cat.slug}`);
                  }
                  closeMobile();
                }}
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

        <div className="flex items-center justify-between pr-2">
          <SectionLabel>ประวัติแชท</SectionLabel>
          {filteredNatalThreads.length > 0 || filteredTransitThreads.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmAction({ kind: "clear-all" })}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--muted-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--danger)]"
              title="ลบประวัติแชททั้งหมด"
            >
              ล้างทั้งหมด
            </button>
          ) : null}
        </div>
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
              <div
                key={t.id}
                className={`group flex items-center gap-0.5 rounded-lg pr-1 transition hover:bg-[var(--surface-2)] ${
                  activeThread === t.id ? "bg-[var(--surface-3)]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => openThread(t.id, t.categorySlug)}
                  onMouseEnter={() => {
                    void prefetchThread(t.id);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 truncate px-3 py-2 text-left text-xs transition hover:text-[var(--foreground)] ${
                    activeThread === t.id
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {t.categorySlug ? (
                    <span className="shrink-0 text-[var(--primary)]">
                      <CategoryIcon slug={t.categorySlug} />
                    </span>
                  ) : null}
                  <span
                    className="truncate"
                    title="ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void renameThread(t.id, t.title);
                    }}
                  >
                    {t.title}
                  </span>
                </button>
                <button
                  type="button"
                  title="เปลี่ยนชื่อ"
                  aria-label="เปลี่ยนชื่อแชท"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void renameThread(t.id, t.title);
                  }}
                  className="shrink-0 rounded-md px-1.5 py-1 text-[10px] text-[var(--muted-2)] opacity-70 transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] group-hover:opacity-100"
                >
                  ชื่อ
                </button>
                <button
                  type="button"
                  title="ลบแชท"
                  aria-label="ลบแชท"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void deleteThread(t.id);
                  }}
                  className="shrink-0 rounded-md px-1.5 py-1 text-[10px] text-[var(--muted-2)] opacity-70 transition hover:bg-[var(--surface-3)] hover:text-[var(--danger)] group-hover:opacity-100"
                >
                  ลบ
                </button>
              </div>
            ))
          )}
        </nav>

        <SidebarDivider />

        <Link
          href="/dashboard"
          onClick={(e) => {
            if (isPlainLeftClick(e)) {
              e.preventDefault();
              chatNav("/dashboard");
            }
            closeMobile();
          }}
          className="press-scale mb-3 flex items-center gap-2.5 rounded-full border border-[var(--secondary)]/45 bg-[var(--secondary)]/10 px-3.5 py-2.5 text-sm font-semibold text-[var(--secondary-active)] transition hover:bg-[var(--secondary)]/15"
        >
          <NewChatIcon /> เริ่มสนทนาใหม่
        </Link>

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
              <div
                key={t.id}
                className={`group flex items-center gap-0.5 rounded-lg pr-1 transition hover:bg-[var(--surface-2)] ${
                  activeThread === t.id ? "bg-[var(--surface-3)]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => openThread(t.id, t.categorySlug)}
                  onMouseEnter={() => {
                    void prefetchThread(t.id);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 truncate px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] ${
                    activeThread === t.id
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  <span className="shrink-0 text-[var(--primary)]">
                    <TransitIcon />
                  </span>
                  <span
                    className="truncate"
                    title="ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void renameThread(t.id, t.title);
                    }}
                  >
                    {t.title}
                  </span>
                </button>
                <button
                  type="button"
                  title="เปลี่ยนชื่อ"
                  aria-label="เปลี่ยนชื่อแชท"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void renameThread(t.id, t.title);
                  }}
                  className="shrink-0 rounded-md px-1.5 py-1 text-[10px] text-[var(--muted-2)] opacity-70 transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] group-hover:opacity-100"
                >
                  ชื่อ
                </button>
                <button
                  type="button"
                  title="ลบแชท"
                  aria-label="ลบแชท"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void deleteThread(t.id);
                  }}
                  className="shrink-0 rounded-md px-1.5 py-1 text-[10px] text-[var(--muted-2)] opacity-70 transition hover:bg-[var(--surface-3)] hover:text-[var(--danger)] group-hover:opacity-100"
                >
                  ลบ
                </button>
              </div>
            ))
          )}
        </nav>
      </div>
    </>
  );

  return (
    <div
      className="flex h-[100dvh] overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      {/* Mobile drawer: overlay fades, panel slides. transform/opacity only. */}
      {mobileRender && (
        <div
          className={`fixed inset-0 z-40 md:hidden ${
            mobileShown ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ease-[var(--ease-out-quart)] ${
              mobileShown ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMobile}
            aria-label="ปิดเมนู"
            tabIndex={mobileShown ? 0 : -1}
          />
          <aside
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="เมนู"
            className={`relative z-50 flex h-full w-[86vw] max-w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-[240ms] ease-[var(--ease-out-quart)] will-change-transform ${
              mobileShown ? "translate-x-0" : "-translate-x-full"
            }`}
            aria-hidden={!mobileShown}
          >
            <div className="flex h-full flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {sidebarContent}
              </div>
              {renderProfileFooter(mobileProfileBtnRef)}
            </div>
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
            collapsed
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none invisible opacity-0"
          }`}
          aria-hidden={!collapsed}
        >
          <CollapsedRail
            activeCat={activeCat}
            settingsOpen={settingsOpen && collapsed}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            onCloseSettings={() => setSettingsOpen(false)}
            onSettingsNavigate={onSettingsNavigate}
            onExpand={() => setCollapsed(false)}
            onOpenModal={openModal}
            displayName={displayName}
            image={user?.image}
            creditBalance={user?.creditBalance}
          />
        </div>

        <div
          className={`absolute inset-0 overflow-hidden transition-opacity duration-200 ${
            collapsed
              ? "pointer-events-none invisible opacity-0"
              : "pointer-events-auto opacity-100"
          }`}
          aria-hidden={collapsed}
        >
          <div className="flex h-full w-72 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {sidebarContent}
            </div>
            {renderProfileFooter(desktopProfileBtnRef)}
          </div>
        </div>
      </aside>

      <div
        className="relative flex min-w-0 flex-1 flex-col"
        // While the mobile drawer is open, the content behind it is inert — no
        // focus, no clicks reach it, so the drawer is a real modal.
        inert={mobileShown}
      >
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
          <Link
            href="/dashboard"
            className="min-w-0"
            onClick={(e) => {
              if (isPlainLeftClick(e)) {
                e.preventDefault();
                chatNav("/dashboard");
              }
            }}
          >
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

      <ConfirmModal
        open={confirmAction !== null}
        danger
        busy={confirmBusy}
        title={
          confirmAction?.kind === "clear-all"
            ? "ล้างประวัติแชททั้งหมด?"
            : "ลบแชทนี้ทั้งหมด?"
        }
        message={
          confirmAction?.kind === "clear-all"
            ? "จะลบทุกบทสนทนา (พื้นดวงเดิม + ดวงจร) ออกถาวร กู้คืนไม่ได้"
            : "จะลบบทสนทนานี้ออกถาวร กู้คืนไม่ได้"
        }
        confirmLabel={
          confirmAction?.kind === "clear-all" ? "ล้างทั้งหมด" : "ลบ"
        }
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirmAction(null)}
      />

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
          onCancelled={() => refreshLight()}
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
  onSettingsNavigate,
  onExpand,
  onOpenModal,
  displayName,
  image,
  creditBalance,
}: {
  activeCat: string | null;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onSettingsNavigate: () => void;
  onExpand: () => void;
  onOpenModal: (m: SettingsModal) => void;
  displayName: string;
  image?: string | null;
  creditBalance?: number;
}) {
  const { filteredCategories } = useAppData();
  const chatNav = useChatNav();
  const railBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-full w-16 flex-col items-center py-3">
      <Link
        href="/dashboard"
        className="press-scale mb-1 rounded-lg p-1 transition hover:bg-[var(--surface-2)]"
        aria-label="horasard"
        title="horasard"
        onClick={(e) => {
          if (isPlainLeftClick(e)) {
            e.preventDefault();
            chatNav("/dashboard");
          }
        }}
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
        onClick={(e) => {
          if (isPlainLeftClick(e)) {
            e.preventDefault();
            chatNav("/dashboard");
          }
        }}
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
              onClick={(e) => {
                if (isPlainLeftClick(e)) {
                  e.preventDefault();
                  chatNav(`/dashboard?cat=${cat.slug}`);
                }
              }}
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
            onNavigate={onSettingsNavigate}
            anchorRef={railBtnRef}
          />
        )}
        {creditBalance != null && (
          <Link
            href="/account"
            className="rounded-md px-1 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--foreground)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
            title={`เครดิต ${creditBalance}`}
            aria-label={`เครดิต ${creditBalance}`}
          >
            {creditBalance}
          </Link>
        )}
        <ThemePicker align="center" />
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
