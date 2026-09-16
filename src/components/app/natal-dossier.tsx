"use client";

import Link from "next/link";
import { NatalChartIcon } from "./sidebar-icons";
import { isPlainLeftClick, useChatNav } from "./chat-nav";
import { natalAtlasHref } from "@/lib/chat-navigation-links";

type Props = {
  onNavigate?: () => void;
  activeView?: string | null;
  activeSlug?: string | null;
};

/**
 * Sidebar natal nav. The natal page now explains every life topic on one
 * screen, so the per-category rows (which opened the same page filtered) were
 * duplicates — one "พื้นดวงเดิม" entry is all that is needed.
 */
export function NatalDossier({ onNavigate, activeView }: Props) {
  const chatNav = useChatNav();
  const atlasOpen = activeView === "natal-chart";

  return (
    <nav className="flex flex-col gap-0.5" aria-label="พื้นดวงเดิม">
      <Link
        href={natalAtlasHref()}
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            event.preventDefault();
            chatNav(natalAtlasHref());
          }
          onNavigate?.();
        }}
        aria-current={atlasOpen ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
          atlasOpen
            ? "bg-[var(--background)] text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--border)]"
            : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
        }`}
      >
        <span className="text-[var(--foreground)]">
          <NatalChartIcon />
        </span>
        พื้นดวงเดิม
      </Link>
    </nav>
  );
}
