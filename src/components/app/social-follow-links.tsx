"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CmsFooterLink } from "@/lib/cms-keys";

const SocialLinksContext = createContext<CmsFooterLink[]>([]);

function isFacebookLink(href: string) {
  const hostname = new URL(href).hostname.toLowerCase();
  return hostname === "facebook.com" || hostname.endsWith(".facebook.com")
    || hostname === "fb.me";
}

function FacebookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      className="size-4 shrink-0"
    >
      <circle cx="12" cy="12" r="12" fill="#0866FF" />
      <path
        fill="white"
        d="M13.5 20v-7h2.35l.35-2.73h-2.7V8.53c0-.79.22-1.33 1.35-1.33h1.44V4.76A19.2 19.2 0 0 0 14.19 4c-2.08 0-3.5 1.27-3.5 3.6v2.67H8.34V13h2.35v7z"
      />
    </svg>
  );
}

export function SocialLinksProvider({
  links,
  children,
}: {
  links: CmsFooterLink[];
  children?: ReactNode;
}) {
  return (
    <SocialLinksContext.Provider value={links}>
      {children}
    </SocialLinksContext.Provider>
  );
}

export function SocialFollowLinks({ menu = false }: { menu?: boolean }) {
  const configuredLinks = useContext(SocialLinksContext);
  // Defend against legacy CMS values as well as empty/unpublished settings.
  const links = configuredLinks.filter((link) => {
    if (!link.label.trim()) return false;
    try {
      const url = new URL(link.href);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });
  if (links.length === 0) return null;

  return (
    <p
      className={menu
        ? "px-3 py-2 text-sm leading-6 text-[var(--muted)]"
        : "mt-1 text-center text-[11px] leading-5 text-[var(--muted)]"}
    >
      สอบถามข้อมูล และติดตามได้ทาง :{" "}
      {links.map((link, index) => (
        <span key={`${link.href}-${index}`} className="inline-block">
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${link.label} (เปิดแท็บใหม่)`}
            className="inline-flex items-center gap-1 align-middle py-1 font-medium text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-hover)] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            {isFacebookLink(link.href) ? <FacebookIcon /> : null}
            <span>{link.label}</span>
          </a>
        </span>
      ))}
    </p>
  );
}
