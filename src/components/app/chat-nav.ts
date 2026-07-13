"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

/** Soft chat switches broadcast on this event (see useChatNav). */
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
 * Dashboard route query (`cat`, `thread`) that stays in sync with soft nav.
 *
 * `useSearchParams()` from Next does not update after `history.pushState` /
 * `replaceState` (Next.js 16). Chat uses native history to avoid remounting
 * mid-stream, so consumers must read `window.location` and listen for
 * `horasard:soft-nav`.
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
 * Navigate inside the chat route without a Next navigation.
 *
 * Chat destinations share `/dashboard` with different search params. Using
 * <Link> / router.push remounts ChatView and drops in-flight answers.
 * Native history + a soft-nav event keeps the chat mounted like ChatGPT.
 */
export function useChatNav() {
  return useCallback((href: string) => {
    if (typeof window === "undefined") return;
    const next = href.startsWith("/") ? href : `/${href}`;
    if (window.location.pathname + window.location.search === next) return;
    window.history.pushState(window.history.state, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(
      new CustomEvent(CHAT_SOFT_NAV_EVENT, { detail: { href: next } }),
    );
  }, []);
}

/** True for a click we should handle in-app (not open-in-new-tab). */
export function isPlainLeftClick(e: React.MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}
