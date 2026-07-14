"use client";

import { useCallback } from "react";

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
 */
export function softNavigate(href: string, opts?: { replace?: boolean }) {
  if (typeof window === "undefined") return;
  const next = href.startsWith("/") ? href : `/${href}`;
  if (window.location.pathname + window.location.search === next) return;
  if (opts?.replace) {
    window.history.replaceState(null, "", next);
  } else {
    window.history.pushState(null, "", next);
  }
  // Listeners that treat soft chat switches specially (NavProgress).
  window.dispatchEvent(
    new CustomEvent("horasard:soft-nav", { detail: { href: next } }),
  );
}

/** Hook form of softNavigate for components that navigate on events. */
export function useChatNav() {
  return useCallback((href: string) => softNavigate(href), []);
}

/** True for a click we should handle in-app (not open-in-new-tab). */
export function isPlainLeftClick(e: React.MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}
