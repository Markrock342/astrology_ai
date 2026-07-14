"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

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
  // Listeners that treat soft chat switches specially (NavProgress).
  window.dispatchEvent(
    new CustomEvent("horasard:soft-nav", { detail: { href: next } }),
  );
  return true;
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
