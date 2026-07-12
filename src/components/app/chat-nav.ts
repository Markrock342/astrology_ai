"use client";

import { useCallback } from "react";

/**
 * Navigate inside the chat route without a Next navigation.
 *
 * Every chat destination — a thread, a category, a new chat — is the same route
 * with different search params. Going there through <Link> or router.push runs a
 * real navigation: the RSC payload is refetched and /dashboard re-renders, which
 * remounts ChatView and throws away its state. Mid-answer that reads as "the page
 * reloaded and my message vanished", and the answer being streamed is orphaned.
 *
 * Next syncs pushState/replaceState into useSearchParams, so changing the URL
 * this way re-renders ChatView in place instead of remounting it — the chat keeps
 * its messages and its in-flight answer, the way switching chats should behave.
 */
export function useChatNav() {
  return useCallback((href: string) => {
    if (typeof window === "undefined") return;
    if (window.location.pathname + window.location.search === href) return;
    window.history.pushState(null, "", href);
  }, []);
}

/**
 * True for a click we should handle in-app. Modified clicks and middle clicks
 * belong to the browser (open in a new tab), so the <Link> href must still win.
 */
export function isPlainLeftClick(e: React.MouseEvent): boolean {
  return (
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}
