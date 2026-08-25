"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  categorySlugFromLabel,
  dispatchOpenTransit,
  natalCategoryHref,
  parseDashboardChatHref,
} from "@/lib/chat-navigation-links";

/** Soft chat switches broadcast on this event (see softNavigate / useChatNav). */
export const CHAT_SOFT_NAV_EVENT = "horasard:soft-nav";

function subscribeChatRoute(onStoreChange: () => void) {
  const notify = () => onStoreChange();
  window.addEventListener("popstate", notify);
  window.addEventListener(CHAT_SOFT_NAV_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CHAT_SOFT_NAV_EVENT, notify);
  };
}

function readChatRouteSearch(): string {
  return window.location.search.replace(/^\?/, "");
}

/** Parse `?cat=` / `?thread=` from a search string (no leading `?`). */
export function parseChatRouteSearch(search: string): {
  cat: string | null;
  thread: string | null;
} {
  const params = new URLSearchParams(search);
  return {
    cat: params.get("cat"),
    thread: params.get("thread"),
  };
}

/**
 * Soft pushState is only safe when staying on `/dashboard`.
 * From `/account` or `/onboarding`, pushState would change the URL bar
 * without swapping App Router children — the settings page would stick.
 */
export function shouldUseSoftChatNav(
  currentPathname: string,
  href: string,
): boolean {
  try {
    const targetPath = new URL(href, "http://local").pathname;
    return currentPathname === "/dashboard" && targetPath === "/dashboard";
  } catch {
    return false;
  }
}

/**
 * Soft-navigate inside the chat route without a full Next navigation.
 *
 * Chat destinations share `/dashboard` with different search params. Using
 * <Link> / router.push remounts ChatView and drops in-flight answers, so we
 * use the native History API — the Next 16-documented shallow-routing path
 * (docs: 01-app/02-guides/single-page-applications.md).
 *
 * CRITICAL: the state argument must be a PLAIN value (null). Next patches
 * pushState/replaceState to dispatch ACTION_RESTORE, which is what syncs
 * `usePathname`/`useSearchParams` — but it bails when the state carries
 * Next's own `__NA`/`_N` markers (it assumes an internal router call).
 * Passing `window.history.state` re-sent those markers, so the URL changed
 * while every useSearchParams consumer (sidebar highlight, ChatView catSlug)
 * stayed stale. Next copies its internal tree onto the new entry itself, so
 * back/forward keeps working with null state.
 *
 * EQUALLY CRITICAL: this is shallow routing — it swaps the URL, not the route.
 * ACTION_RESTORE reconciles the CURRENT tree; it never fetches another route's
 * RSC payload. Pointing it at a different pathname (e.g. /account → /dashboard)
 * changes the address bar while the old page stays mounted. Cross-route callers
 * must fall back to a real navigation — see useChatNav.
 *
 * Consumers that must stay correct even if Next's search-param sync flakes
 * should use `useChatRouteSearchParams` (reads `window.location` + this event).
 *
 * @returns true if the URL was handled here; false when the caller must
 *          perform a real (router) navigation instead.
 */
export function softNavigate(
  href: string,
  opts?: { replace?: boolean },
): boolean {
  if (typeof window === "undefined") return false;
  const next = href.startsWith("/") ? href : `/${href}`;
  if (window.location.pathname + window.location.search === next) return true;

  const target = new URL(next, window.location.origin);
  if (target.pathname !== window.location.pathname) return false;

  if (opts?.replace) {
    window.history.replaceState(null, "", next);
  } else {
    window.history.pushState(null, "", next);
  }
  window.dispatchEvent(
    new CustomEvent(CHAT_SOFT_NAV_EVENT, { detail: { href: next } }),
  );
  return true;
}

/**
 * Dashboard route query (`cat`, `thread`) that stays in sync with soft nav.
 *
 * Prefer this over `useSearchParams()` for chat UI: soft history updates can
 * leave Next's hook stale; this reads `window.location` and listens for
 * `horasard:soft-nav` / `popstate`.
 */
export function useChatRouteSearchParams(): URLSearchParams {
  const nextParams = useSearchParams();
  const serverSnapshot = nextParams.toString();

  const search = useSyncExternalStore(
    subscribeChatRoute,
    readChatRouteSearch,
    () => serverSnapshot,
  );

  return new URLSearchParams(search);
}

/**
 * Navigate to a chat destination: shallow when it is a query-only change on the
 * current route, a real navigation otherwise (so leaving /account back to the
 * chat actually renders the chat).
 */
export function useChatNav() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (!softNavigate(href)) router.push(href);
    },
    [router],
  );
}

/** True for a click we should handle in-app (not open-in-new-tab). */
export function isPlainLeftClick(e: React.MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}

/**
 * Dashboard links in chat must not use Next `<Link>` navigation: that remounts
 * ChatView and can drop `?cat=`, sending the user back to the empty picker.
 */
export function handleDashboardChatLinkClick(
  event: React.MouseEvent,
  href: string,
  linkText?: string,
): void {
  if (!isPlainLeftClick(event)) return;
  const parsed = parseDashboardChatHref(href);
  if (!parsed.isDashboard) return;

  const cat = parsed.cat ?? (linkText ? categorySlugFromLabel(linkText) : null);

  if (parsed.action === "transit") {
    event.preventDefault();
    const fromUrl =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("cat")
        : null;
    dispatchOpenTransit(cat ?? fromUrl);
    return;
  }

  if (!cat) return;
  if (softNavigate(natalCategoryHref(cat))) event.preventDefault();
}
