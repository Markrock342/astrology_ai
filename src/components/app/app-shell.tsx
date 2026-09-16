"use client";

import { useCallback, useEffect, useRef, useState, type RefObject, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BrandLockup, BrandMark } from "@/components/brand-logo";
// useSearchParams is via useChatRouteSearchParams (soft-nav safe)
import { SettingsPopover, type SettingsModal } from "./settings-popover";
import {
  CancelMembershipModal,
  ChangePasswordModal,
  RenameModal,
} from "./settings-modals";
import { ConfirmModal, ThreadRenameModal } from "./confirm-modal";
import {
  CollapseSidebarIcon,
  ExpandSidebarIcon,
  MenuIcon,
  NatalChartIcon,
  NewChatIcon,
  SearchIcon,
  EditIcon,
  TrashIcon,
} from "./sidebar-icons";
import { useAppData } from "./app-data-provider";
import {
  isPlainLeftClick,
  useChatNav,
  useChatRouteSearchParams,
} from "./chat-nav";
import { VerifyEmailBanner } from "./verify-email-banner";
import { PendingPaymentBanner } from "./pending-payment-banner";
import { ProExpiryBanner } from "./pro-expiry-banner";
import { ProPromotionBanner } from "./pro-promotion-banner";
import { SiteAnnouncementBanner } from "@/components/cms/site-announcement-banner";
import { UserAvatar } from "./user-avatar";
import { ThemePicker } from "./theme-picker";
import { TransitFormModal } from "./transit-form-modal";
import { NatalDossier } from "./natal-dossier";
import { AppFooterContext } from "./app-footer-context";
import type { CmsSiteFooter } from "@/lib/cms-keys";
import {
  clearThreadCache,
  invalidateCachedThread,
  prefetchThread,
} from "./thread-cache";
import { OPEN_TRANSIT_EVENT, natalAtlasHref, readOpenTransitDetail } from "@/lib/chat-navigation-links";

export function AppShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  /** Site footer (CMS); the chat renders it at the very end of its scroll area. */
  footer?: CmsSiteFooter | null;
}) {
  const searchParams = useChatRouteSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  // Two-phase mobile drawer so it can animate on both enter and exit:
  // `mobileRender` keeps it mounted, `mobileShown` drives the slide/fade.
  const [mobileRender, setMobileRender] = useState(false);
  const [mobileShown, setMobileShown] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [threadActionsOpen, setThreadActionsOpen] = useState<string | null>(null);
  const [transitOpen, setTransitOpen] = useState(
    () => searchParams.get("action") === "transit",
  );
  const [transitCategorySlug, setTransitCategorySlug] = useState<string | null>(
    () => searchParams.get("cat"),
  );
  const [activeModal, setActiveModal] = useState<SettingsModal>(null);
  // Destructive-action confirm (delete one thread / clear all history) uses a
  // styled modal instead of window.confirm.
  const [confirmAction, setConfirmAction] = useState<
    { kind: "delete"; threadId: string } | { kind: "clear-all" } | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    threadId: string;
    title: string;
  } | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dismissActionError = useCallback(() => setActionError(null), []);
  // Separate anchors: sidebarContent mounts in both the mobile drawer and the
  // CSS-hidden desktop aside — one shared ref would point at the hidden button.
  const mobileProfileBtnRef = useRef<HTMLButtonElement>(null);
  const desktopProfileBtnRef = useRef<HTMLButtonElement>(null);
  const closeMobileTimer = useRef<number | null>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  // What had focus before the drawer opened, so we can hand it back on close.
  const focusBeforeDrawer = useRef<HTMLElement | null>(null);
  const activeThread = searchParams.get("thread");
  const chatNav = useChatNav();

  const {
    user,
    refresh,
    removeThreadLocal,
    renameThreadLocal,
    clearThreadsLocal,
    refreshLight,
    filteredNatalThreads,
    filteredTransitThreads,
    searchQuery,
    setSearchQuery,
    loading,
    loadError,
  } = useAppData();

  // One list for the sidebar (client request): natal and transit chats
  // together, newest first — the separate "ประวัติแชท" section is gone.
  const conversationThreads = useMemo(
    () =>
      [
        ...filteredTransitThreads.map((t) => ({ ...t, kind: "transit" as const })),
        ...filteredNatalThreads.map((t) => ({ ...t, kind: "natal" as const })),
      ].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
    [filteredTransitThreads, filteredNatalThreads],
  );

  useEffect(() => {
    const openTransit = (event: Event) => {
      const fromEvent = readOpenTransitDetail(event);
      const fromUrl = new URLSearchParams(window.location.search).get("cat");
      setTransitCategorySlug(fromEvent ?? fromUrl);
      setTransitOpen(true);
    };
    window.addEventListener(OPEN_TRANSIT_EVENT, openTransit);
    return () => window.removeEventListener(OPEN_TRANSIT_EVENT, openTransit);
  }, []);

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
        setActionError(json?.error?.message ?? "ลบแชทไม่สำเร็จ");
        void refresh();
        return;
      }
      // The active thread was already redirected away above, before the DELETE.
      await refreshLight();
    } catch {
      setActionError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
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
        setActionError(json?.error?.message ?? "ล้างประวัติไม่สำเร็จ");
        void refresh();
        return;
      }
      await refreshLight();
    } catch {
      setActionError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
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

  function openRenameThread(threadId: string, currentTitle: string) {
    setRenameError(null);
    setRenameTarget({ threadId, title: currentTitle });
  }

  async function submitRename(nextTitle: string) {
    if (!renameTarget) return;
    const trimmed = nextTitle.trim();
    if (!trimmed || trimmed === renameTarget.title.trim()) {
      setRenameTarget(null);
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/conversations/${renameTarget.threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setRenameError(json?.error?.message ?? "เปลี่ยนชื่อไม่สำเร็จ");
        return;
      }
      renameThreadLocal(renameTarget.threadId, trimmed);
      setRenameTarget(null);
      void refreshLight();
    } catch {
      setRenameError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setRenameBusy(false);
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

  // Drag-to-open / drag-to-close (ChatGPT-style): the drawer follows the
  // finger. Pull in from the left edge to open, drag the open drawer left to
  // close; release snaps to whichever side is nearer (or the flick direction).
  // Position is written straight to the DOM during the gesture — no re-render
  // per touchmove — and the class transition takes over on release. It never
  // calls preventDefault, so vertical scrolling is untouched: the gesture is
  // only claimed once the movement is clearly horizontal.
  const drag = useRef<{
    x: number;
    y: number;
    /** Opening from the closed state (edge pull) vs. closing the open drawer. */
    opening: boolean;
    mode: "pending" | "drag" | "scroll";
    width: number;
    dx: number;
    lastX: number;
    lastT: number;
    /** px per ms, positive = rightwards. */
    vx: number;
  } | null>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);

  function drawerWidth() {
    return (
      mobileDrawerRef.current?.offsetWidth ??
      Math.min(window.innerWidth * 0.86, 288)
    );
  }

  /** `offset` is the drawer's translateX in px: -width = hidden, 0 = open. */
  function paintDrawer(offset: number, width: number) {
    const el = mobileDrawerRef.current;
    const ov = overlayRef.current;
    if (el) {
      // Tailwind v4's translate-x-* classes set the `translate` property, so
      // that is what we override — an inline `transform` would stack on top.
      el.style.transition = "none";
      el.style.translate = `${offset}px 0`;
    }
    if (ov) {
      ov.style.transition = "none";
      ov.style.opacity = String(Math.max(0, Math.min(1, 1 + offset / width)));
    }
  }

  /** Hand control back to the CSS classes; the transition runs from the
      current inline position to the class target. */
  function releaseDrawer() {
    const el = mobileDrawerRef.current;
    const ov = overlayRef.current;
    if (el) {
      el.style.transition = "";
      el.style.translate = "";
    }
    if (ov) {
      ov.style.transition = "";
      ov.style.opacity = "";
    }
  }

  // Plain functions — the React Compiler memoizes them; a manual useCallback
  // here conflicts with it ("existing memoization could not be preserved").
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t || e.touches.length > 1) return;
    const opening = !mobileShown && t.clientX <= 28;
    if (!opening && !mobileShown) {
      drag.current = null;
      return;
    }
    drag.current = {
      x: t.clientX,
      y: t.clientY,
      opening,
      mode: "pending",
      width: drawerWidth(),
      dx: 0,
      lastX: t.clientX,
      lastT: e.timeStamp,
      vx: 0,
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    const d = drag.current;
    const t = e.touches[0];
    if (!d || d.mode === "scroll" || !t) return;
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (d.mode === "pending") {
      // Decide once: mostly vertical → it is a scroll, leave it alone.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        d.mode = "scroll";
        return;
      }
      if (Math.abs(dx) < 10) return;
      d.mode = "drag";
      if (d.opening) {
        // Mount the drawer (still in its hidden position) so it can follow.
        if (closeMobileTimer.current != null) {
          window.clearTimeout(closeMobileTimer.current);
          closeMobileTimer.current = null;
        }
        setMobileRender(true);
      }
    }
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.vx = (t.clientX - d.lastX) / dt;
    d.lastX = t.clientX;
    d.lastT = e.timeStamp;
    d.dx = dx;
    const base = d.opening ? -d.width : 0;
    const offset = Math.max(-d.width, Math.min(0, base + dx));
    paintDrawer(offset, d.width);
  }

  function onTouchEnd() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== "drag") return;
    const flick = 0.35; // px/ms
    const settle = d.width * 0.4;
    const open = d.opening
      ? d.vx > flick || (d.vx > -flick && d.dx > settle)
      : !(d.vx < -flick || (d.vx < flick && -d.dx > settle));
    releaseDrawer();
    if (open) {
      if (closeMobileTimer.current != null) {
        window.clearTimeout(closeMobileTimer.current);
        closeMobileTimer.current = null;
      }
      setMobileShown(true);
    } else {
      closeMobile();
    }
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
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--background)]"
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
              className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--primary)]"
              title="ดู usage / แพ็กเกจ"
            >
              เหลือ{" "}
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {user.usageRemainingPercent}%
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


      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2">
        <section aria-label="ดวงชะตา" className="shrink-0">
          <SectionLabel>ดวงชะตา</SectionLabel>
          <NatalDossier
            onNavigate={closeMobile}
            activeView={searchParams.get("view")}
            activeSlug={searchParams.get("cat")}
          />
        </section>

        <SidebarDivider />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
        {/* New chat + search sit with the conversations they act on (client
            request) — the old "เริ่มดวงจรใหม่" button did the same as new chat. */}
        <div className="mb-2 flex flex-col gap-2">
        <Link
          href="/dashboard"
          onClick={(e) => {
            if (isPlainLeftClick(e)) {
              e.preventDefault();
              chatNav("/dashboard");
            }
            closeMobile();
          }}
          className="press-scale flex min-h-11 items-center gap-2.5 rounded-xl border border-[var(--secondary)]/45 bg-[var(--secondary)]/10 px-3.5 py-2.5 text-sm font-semibold text-[var(--secondary-active)] transition hover:bg-[var(--secondary)]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--secondary-active)]"
        >
          <NewChatIcon /> เริ่มสนทนาใหม่
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
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
        <SectionLabel>การสนทนา</SectionLabel>
        <nav aria-label="การสนทนา" className="flex flex-col gap-0.5">
          {conversationThreads.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--muted-2)]">
              {loading ? "กำลังโหลด…" : "ยังไม่มีการสนทนา"}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
            {conversationThreads.map((t) => (
              <li
                key={t.id}
                className={`group flex items-center gap-0.5 rounded-lg pr-1 transition hover:bg-[var(--background)] ${
                  activeThread === t.id
                    ? "bg-[var(--background)] shadow-[inset_0_0_0_1px_var(--border)]"
                    : ""
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
                  <span
                    className="truncate"
                    title="ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openRenameThread(t.id, t.title);
                    }}
                  >
                    {t.title}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="เปิดเมนูแชท"
                  aria-expanded={threadActionsOpen === t.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setThreadActionsOpen((current) =>
                      current === t.id ? null : t.id,
                    );
                  }}
                  className={`min-h-11 shrink-0 rounded-md px-3 py-2 text-base leading-none text-[var(--muted-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] md:hidden ${
                    threadActionsOpen === t.id ? "hidden" : "inline-flex items-center"
                  }`}
                >
                  ⋯
                </button>
                <button
                  type="button"
                  title="แก้ไขชื่อ"
                  aria-label="แก้ไขชื่อแชท"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openRenameThread(t.id, t.title);
                  }}
                  className={`min-h-11 shrink-0 rounded-md px-2 py-2 text-[var(--muted-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] md:inline-flex md:items-center md:opacity-70 md:group-hover:opacity-100 ${
                    threadActionsOpen === t.id ? "inline-flex items-center" : "hidden"
                  }`}
                >
                  <EditIcon />
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
                  className={`min-h-11 shrink-0 rounded-md px-2 py-2 text-[var(--muted-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--danger)] md:inline-flex md:items-center md:opacity-70 md:group-hover:opacity-100 ${
                    threadActionsOpen === t.id ? "inline-flex items-center" : "hidden"
                  }`}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
            </ul>
          )}
        </nav>
        </div>
      </div>
    </>
  );

  return (
    <div
      className="shape-capsule flex h-[100dvh] overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Mobile drawer: overlay fades, panel slides. transform/opacity only. */}
      {mobileRender && (
        <div
          className={`fixed inset-0 z-40 md:hidden ${
            mobileShown ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <button
            ref={overlayRef}
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
        aria-label="แถบข้าง"
        className={`${
          collapsed ? "w-16" : "w-72"
        } relative z-30 hidden h-full shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-300 ease-[var(--ease-out-quart)] md:flex md:flex-col`}
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
            settingsOpen={settingsOpen && collapsed}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
            onCloseSettings={() => setSettingsOpen(false)}
            onSettingsNavigate={onSettingsNavigate}
            onExpand={() => setCollapsed(false)}
            onOpenModal={openModal}
            displayName={displayName}
            image={user?.image}
            usageRemainingPercent={user?.usageRemainingPercent}
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
        <main className="flex min-h-0 flex-1 flex-col">
          <VerifyEmailBanner />
          <PendingPaymentBanner />
          <ProExpiryBanner />
          <ProPromotionBanner />
          <SiteAnnouncementBanner />
          <AppFooterContext value={footer ?? null}>{children}</AppFooterContext>
        </main>
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

      {renameTarget ? (
        <ThreadRenameModal
          initialTitle={renameTarget.title}
          busy={renameBusy}
          error={renameError}
          onSubmit={(title) => void submitRename(title)}
          onCancel={() => {
            if (renameBusy) return;
            setRenameTarget(null);
            setRenameError(null);
          }}
        />
      ) : null}

      {actionError ? (
        <ActionErrorToast
          message={actionError}
          onDismiss={dismissActionError}
        />
      ) : null}

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
      {transitOpen && (
        <TransitFormModal
          onClose={() => setTransitOpen(false)}
          initialCategorySlug={transitCategorySlug}
        />
      )}
    </div>
  );
}

function CollapsedRail({
  settingsOpen,
  onToggleSettings,
  onCloseSettings,
  onSettingsNavigate,
  onExpand,
  onOpenModal,
  displayName,
  image,
  usageRemainingPercent,
}: {
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onSettingsNavigate: () => void;
  onExpand: () => void;
  onOpenModal: (m: SettingsModal) => void;
  displayName: string;
  image?: string | null;
  usageRemainingPercent?: number;
}) {
  const chatNav = useChatNav();
  const railBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex h-full w-16 flex-col items-center py-3">
      <Link
        href="/dashboard"
        className="press-scale mb-1 rounded-lg p-1 transition hover:bg-[var(--background)]"
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
        className="press-scale rounded-md p-2 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
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

      <nav aria-label="เมนูย่อ" className="mt-3 flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1">
        <button
          type="button"
          title="ราศีจักร"
          aria-label="เปิดราศีจักร"
          onClick={() => chatNav(natalAtlasHref())}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--primary)]/75 transition hover:bg-[var(--background)] hover:text-[var(--primary)]"
        >
          <NatalChartIcon size={20} />
        </button>
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
        {usageRemainingPercent != null && (
          <Link
            href="/account"
            className="rounded-md px-1 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--foreground)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
            title={`usage เหลือ ${usageRemainingPercent}%`}
            aria-label={`usage เหลือ ${usageRemainingPercent} เปอร์เซ็นต์`}
          >
            {usageRemainingPercent}%
          </Link>
        )}
        <ThemePicker />
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

function ActionErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  return createPortal(
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-[120] max-w-sm -translate-x-1/2 rounded-2xl border border-[var(--danger)]/40 bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--danger)] shadow-xl"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-snug">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label="ปิด"
        >
          ปิด
        </button>
      </div>
    </div>,
    document.body,
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
