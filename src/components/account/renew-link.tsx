"use client";

import { useEffect } from "react";

const RENEW_ID = "renew";
const FLASH_MS = 1600;

function revealRenew() {
  const el = document.getElementById(RENEW_ID);
  if (!el) return false;
  // The account page scrolls inside its own container, so a bare hash jump
  // often lands nowhere. scrollIntoView walks up to that container itself.
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("flash-target");
  window.setTimeout(() => el.classList.remove("flash-target"), FLASH_MS);
  return true;
}

/** "ต่ออายุ" — scrolls to the renew card and flashes it, so the click has a
    visible destination instead of a hash that silently does nothing. */
export function RenewLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={`#${RENEW_ID}`}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (revealRenew()) e.preventDefault();
      }}
    >
      {children}
    </a>
  );
}

/** Arriving from /account#renew (the chat banner): do the same scroll once the
    card has mounted — the browser's own hash handling misses it. */
export function RenewHashScroller() {
  useEffect(() => {
    if (window.location.hash !== `#${RENEW_ID}`) return;
    const timer = window.setTimeout(revealRenew, 80);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
