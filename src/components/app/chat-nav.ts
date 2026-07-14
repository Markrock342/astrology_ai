"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
 * Navigate to chat destinations.
 *
 * - Within `/dashboard`: soft history + event (avoids remounting ChatView).
 * - From other app routes (`/account`, `/onboarding`, …): real `router.push`
 *   so App Router swaps children to the dashboard chat view.
 */
export function useChatNav() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (typeof window === "undefined") return;
      const next = href.startsWith("/") ? href : `/${href}`;
      if (window.location.pathname + window.location.search === next) return;

      if (!shouldUseSoftChatNav(window.location.pathname, next)) {
        router.push(next);
        return;
      }

      window.history.pushState(window.history.state, "", next);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent(CHAT_SOFT_NAV_EVENT, { detail: { href: next } }),
      );
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
