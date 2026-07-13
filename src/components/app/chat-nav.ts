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
    window.history.pushState(window.history.state, "", next);
    // Next syncs pushState into useSearchParams; also notify listeners that
    // treat soft chat switches specially (NavProgress, ChatView resets).
    window.dispatchEvent(new PopStateEvent("popstate"));
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
