"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CmsFooterLink } from "@/lib/cms-keys";

const SocialLinksContext = createContext<CmsFooterLink[]>([]);

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
            className="inline-block py-1 font-medium text-[var(--primary)] underline underline-offset-2 hover:text-[var(--primary-hover)] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          >
            {link.label}
          </a>
        </span>
      ))}
    </p>
  );
}
