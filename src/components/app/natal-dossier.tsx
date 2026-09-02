"use client";

import Link from "next/link";
import { isCategoryLocked, useAppData } from "./app-data-provider";
import { CategoryIcon } from "./category-icon";
import { LockIcon } from "./sidebar-icons";
import { isPlainLeftClick, useChatNav } from "./chat-nav";
import { natalAtlasHref } from "@/lib/chat-navigation-links";
import { NATAL_FACT_HOUSES } from "@/lib/natal-category-facts";
import type { Category } from "./nav-data";

type Props = {
  onNavigate?: () => void;
  activeSlug?: string | null;
};

/** Sidebar: one column of category icons. The atlas opens on the right. */
export function NatalDossier({ onNavigate, activeSlug }: Props) {
  const { user, categories } = useAppData();
  const chatNav = useChatNav();
  const plan = user?.plan ?? "FREE";
  const natalCategories = categories.filter(
    (category) => category.slug in NATAL_FACT_HOUSES,
  );

  if (natalCategories.length === 0) return null;

  return (
    <nav className="flex flex-col items-start gap-0.5" aria-label="หมวดพื้นดวงเดิม">
      {natalCategories.map((category) => {
        const locked = isCategoryLocked(category, plan);
        const active = activeSlug === category.slug;
        if (locked) {
          return (
            <Link
              key={category.slug}
              href="/account"
              onClick={onNavigate}
              title={`${category.label} · ปลดล็อกด้วย Pro`}
              aria-label={`${category.label} ปลดล็อกด้วย Pro`}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[var(--primary)]/55 transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <CategoryIcon slug={category.slug} icon={category.icon} size={20} />
              <span className="absolute right-1 top-1 text-[var(--muted-2)]">
                <LockIcon size={9} />
              </span>
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
      aria-label={category.label}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (isPlainLeftClick(event)) {
          event.preventDefault();
          chatNav(href);
        }
        onNavigate?.();
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
        active
          ? "bg-[var(--background)] text-[var(--primary)] shadow-[inset_0_0_0_1px_var(--border)]"
          : "text-[var(--primary)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      }`}
    >
      <CategoryIcon slug={category.slug} icon={category.icon} size={20} />
    </Link>
  );
}
