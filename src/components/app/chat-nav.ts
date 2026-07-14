"use client";

import { useCallback } from "react";

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
    // Pass null — NOT window.history.state. Next patches pushState and skips
    // syncing useSearchParams when data already has `__NA` (internal marker).
    // null lets the patch copy internals + dispatch ACTION_RESTORE so cat/thread
    // query updates actually reach AppShell / ChatView.
    window.history.pushState(null, "", next);
    window.dispatchEvent(
      new CustomEvent("horasard:soft-nav", { detail: { href: next } }),
    );
  }, []);
}

/** True for a click we should handle in-app (not open-in-new-tab). */
export function isPlainLeftClick(e: React.MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}
