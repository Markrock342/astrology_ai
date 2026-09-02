"use client";

import Link from "next/link";
import { isCategoryLocked, useAppData } from "./app-data-provider";
import { CategoryIcon } from "./category-icon";
import { LockIcon, NatalChartIcon } from "./sidebar-icons";
import { isPlainLeftClick, useChatNav } from "./chat-nav";
import { natalAtlasHref } from "@/lib/chat-navigation-links";
import { NATAL_FACT_HOUSES } from "@/lib/natal-category-facts";
import type { Category } from "./nav-data";

type Props = {
  onNavigate?: () => void;
  activeView?: string | null;
  activeSlug?: string | null;
};

/** Sidebar natal nav: named rows like the original list, atlas opens on the right. */
export function NatalDossier({ onNavigate, activeView, activeSlug }: Props) {
  const { user, categories } = useAppData();
  const chatNav = useChatNav();
  const plan = user?.plan ?? "FREE";
  const natalCategories = categories.filter(
    (category) => category.slug in NATAL_FACT_HOUSES,
  );
  const atlasOpen = activeView === "natal-chart";

  return (
    <nav className="flex flex-col gap-0.5" aria-label="หมวดพื้นดวงเดิม">
      <Link
        href={natalAtlasHref()}
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            event.preventDefault();
            chatNav(natalAtlasHref());
          }
          onNavigate?.();
        }}
        aria-current={atlasOpen && !activeSlug ? "page" : undefined}
        className={`mb-0.5 flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
          atlasOpen && !activeSlug
            ? "bg-[var(--background)] text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--border)]"
            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span className="text-[var(--primary)]">
            <NatalChartIcon />
          </span>
          ดวงจักรกำเนิด
        </span>
        <span className="text-[10px] text-[var(--muted-2)]">พื้นดวง</span>
      </Link>

      {natalCategories.map((category) => {
        const locked = isCategoryLocked(category, plan);
        const active = atlasOpen && activeSlug === category.slug;
        if (locked) {
          return (
            <Link
              key={category.slug}
              href="/account"
              onClick={onNavigate}
              title={`${category.label} · ปลดล็อกด้วย Pro`}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <span className="relative text-[var(--primary)]/55">
                <CategoryIcon slug={category.slug} icon={category.icon} />
                <span className="absolute -right-1.5 -top-1 text-[var(--muted-2)]">
                  <LockIcon size={10} />
                </span>
              </span>
              {category.label}
            </Link>
          );
        }

        return (
          <NatalCategoryLink
            key={category.slug}
            category={category}
            active={active}
            onNavigate={onNavigate}
            chatNav={chatNav}
          />
        );
      })}
    </nav>
  );
}

function NatalCategoryLink({
  category,
  active,
  onNavigate,
  chatNav,
}: {
  category: Category;
  active: boolean;
  onNavigate?: () => void;
  chatNav: (href: string) => void;
}) {
  const href = natalAtlasHref(category.slug);
  return (
    <Link
      href={href}
      title={category.label}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (isPlainLeftClick(event)) {
          event.preventDefault();
          chatNav(href);
        }
        onNavigate?.();
      }}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-[var(--background)] text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--border)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      }`}
    >
      <span className="text-[var(--primary)]">
        <CategoryIcon slug={category.slug} icon={category.icon} />
      </span>
      {category.label}
    </Link>
  );
}
