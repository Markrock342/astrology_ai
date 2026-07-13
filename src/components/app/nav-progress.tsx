"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CHAT_SOFT_NAV_EVENT } from "@/components/app/chat-nav";

/**
 * Top progress bar for real route changes only.
 * Soft chat switches on /dashboard (thread/cat query) must NOT flash a
 * full-page "loading" bar — that is what felt like a forced refresh.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = `${pathname}?${searchParams.toString()}`;
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const visible = targetUrl !== null && targetUrl !== urlKey;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // Same app shell, query-only — soft chat nav, no progress bar.
      if (url.pathname === pathname && pathname.startsWith("/dashboard")) {
        return;
      }

      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      if (nextKey === urlKey) return;
      setTick((n) => n + 1);
      setTargetUrl(nextKey);
    }

    // Bubble phase so preventDefault from soft-nav handlers is visible.
    document.addEventListener("click", onClick, false);
    return () => document.removeEventListener("click", onClick, false);
  }, [urlKey, pathname]);

  useEffect(() => {
    function onSoftNav() {
      setTargetUrl(null);
    }
    window.addEventListener(CHAT_SOFT_NAV_EVENT, onSoftNav);
    return () => window.removeEventListener(CHAT_SOFT_NAV_EVENT, onSoftNav);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => setTargetUrl(null), 8000);
    return () => window.clearTimeout(id);
  }, [visible, tick]);

  if (!visible) return null;

  return (
    <div
      key={tick}
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
      role="progressbar"
      aria-valuetext="กำลังโหลด"
      aria-busy="true"
    />
  );
}
