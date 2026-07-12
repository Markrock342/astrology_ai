"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * ChatGPT-style top progress bar: starts on internal link click, clears when
 * the URL settles. Gives instant feedback while force-dynamic RSC streams.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = `${pathname}?${searchParams.toString()}`;
  /** Destination URL key while a navigation is in flight; null when idle. */
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
      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      if (nextKey === urlKey) return;
      setTick((n) => n + 1);
      setTargetUrl(nextKey);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [urlKey]);

  // Safety: clear stuck bar if navigation never settles (e.g. cancelled).
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
