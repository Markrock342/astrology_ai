"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isCategoryLocked, useAppData } from "./app-data-provider";
import { CategoryIcon } from "./category-icon";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { HoroscopeChartPanel } from "./horoscope-chart-panel";
import { ChartPreparingIndicator } from "./natal-chart-banner";
import { LockIcon } from "./sidebar-icons";
import { useNatalChart } from "./use-natal-chart";
import {
  askPromptForNatalCategory,
  natalFactsForCategory,
  natalSourceLabel,
  NATAL_FACT_HOUSES,
} from "@/lib/natal-category-facts";
import { dispatchAskFromChart } from "@/lib/chat-navigation-links";
import type { ChartJson } from "@/types/chart";
import type { Category } from "./nav-data";

const REVEAL_HOLD_MS = 560;

type Props = {
  onAsk?: () => void;
};

export function NatalDossier({ onAsk }: Props) {
  const { user, categories, repairNatalChart } = useAppData();
  const plan = user?.plan ?? "FREE";
  const natalCategories = categories.filter(
    (category) => category.slug in NATAL_FACT_HOUSES,
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const selected = natalCategories.find((item) => item.slug === selectedSlug);
  const load = useNatalChart({ enabled: selectedSlug !== null });

  useEffect(() => {
    return () => {
      if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
    };
  }, []);

  function clearHoldTimer() {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function ask(prompt: string) {
    dispatchAskFromChart(prompt);
    onAsk?.();
  }

  function closeCategory() {
    clearHoldTimer();
    setHolding(false);
    setSelectedSlug(null);
  }

  function openCategory(category: Category) {
    if (isCategoryLocked(category, plan)) return;
    clearHoldTimer();
    setSelectedSlug(category.slug);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setHolding(false);
      return;
    }
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      setHolding(false);
      holdTimer.current = null;
    }, REVEAL_HOLD_MS);
  }

  if (!selected) {
    return (
      <NatalCategoryIcons
        categories={natalCategories}
        plan={plan}
        onOpen={openCategory}
        onNavigate={onAsk}
      />
    );
  }

  const revealing = holding || load.status === "idle" || load.status === "loading";

  return (
    <div className="flex max-h-[min(52vh,28rem)] flex-col overflow-hidden">
      <button
        type="button"
        onClick={closeCategory}
        className="mb-1 flex min-h-9 shrink-0 items-center gap-1 px-1 text-[11px] text-[var(--muted-2)] transition hover:text-[var(--foreground)]"
      >
        ← หมวดพื้นดวง
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {load.status === "pending" ? (
          <div className="px-1 py-3">
            <ChartPreparingIndicator onRetry={repairNatalChart} compact />
          </div>
        ) : load.status === "failed" ? (
          <NatalDossierMessage
            title="ยังเปิดพื้นดวงไม่ได้"
            message={load.message}
            actionHref="/onboarding"
            actionLabel="ตรวจสอบข้อมูลเกิด"
          />
        ) : load.status === "error" ? (
          <NatalDossierMessage
            title="โหลดพื้นดวงไม่สำเร็จ"
            message={load.message}
            onRetry={load.retry}
          />
        ) : revealing || load.status !== "ready" ? (
          <NatalRevealSpinner category={selected} />
        ) : (
          <NatalCategoryDetail
            category={selected}
            chart={load.chart}
            onAsk={ask}
          />
        )}
      </div>
    </div>
  );
}

function NatalCategoryIcons({
  categories,
  plan,
  onOpen,
  onNavigate,
}: {
  categories: Category[];
  plan: "FREE" | "PRO";
  onOpen: (category: Category) => void;
  onNavigate?: () => void;
}) {
  if (categories.length === 0) return null;

  return (
    <ul className="grid grid-cols-3 gap-1.5 pb-1">
      {categories.map((category) => {
        const locked = isCategoryLocked(category, plan);
        const inner = (
          <>
            <span className="relative flex size-10 items-center justify-center rounded-xl border border-[var(--primary)]/30 bg-[var(--background)]/50 text-[var(--primary)]">
              <CategoryIcon slug={category.slug} icon={category.icon} size={20} />
              {locked ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-[var(--surface)] p-0.5 text-[var(--muted-2)]">
                  <LockIcon size={10} />
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate text-[10px] leading-4 text-[var(--muted)]">
              {category.label}
            </span>
          </>
        );

        return (
          <li key={category.slug}>
            {locked ? (
              <Link
                href="/account"
                onClick={onNavigate}
                className="press-scale flex min-h-11 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center opacity-70 transition hover:opacity-100"
                title={`${category.label} · ปลดล็อกด้วย Pro`}
              >
                {inner}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(category)}
                className="press-scale flex min-h-11 w-full flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-center transition hover:bg-[var(--surface-2)]"
                title={category.label}
              >
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NatalRevealSpinner({ category }: { category: Category }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-8"
      role="status"
      aria-live="polite"
    >
      <div className="relative size-[4.25rem]">
        <span className="absolute inset-0 rounded-full border border-[var(--primary)]/20" />
        <span className="natal-orbit absolute inset-1 rounded-full border border-transparent border-t-[var(--primary)] border-r-[var(--primary)]/40" />
        <span className="absolute inset-[22%] rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/8" />
        <span className="absolute inset-0 flex items-center justify-center text-[var(--primary)]">
          <CategoryIcon slug={category.slug} icon={category.icon} size={22} />
        </span>
      </div>
      <p className="text-xs text-[var(--muted)]">กำลังเปิดพื้นดวงหมวด{category.label}…</p>
    </div>
  );
}

function NatalCategoryDetail({
  category,
  chart,
  onAsk,
}: {
  category: Category;
  chart: ChartJson;
  onAsk: (prompt: string) => void;
}) {
  const facts = natalFactsForCategory(chart, category.slug);
  const prompt =
    category.suggestedQuestions[0] ?? askPromptForNatalCategory(category.label);
  const lagna = chart.chart?.lagna ?? chart.meta.lagna;

  return (
    <div className="animate-fade-up flex flex-col gap-3 pb-3">
      <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--background)]/40 px-3 py-2.5">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <span className="text-[var(--primary)]">
            <CategoryIcon slug={category.slug} icon={category.icon} />
          </span>
          {category.label}
        </p>
        {lagna ? (
          <p className="mt-1 text-[11px] text-[var(--muted)]">ลัคนา {lagna}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted-2)]">
          {chart.meta.birthDisplay}
          {chart.meta.birthDisplay && chart.meta.locationDisplay ? " · " : ""}
          {chart.meta.locationDisplay}
        </p>
        <p className="mt-0.5 text-[10px] text-[var(--muted-2)]">
          {natalSourceLabel(chart)}
        </p>
      </div>

      <HoroscopeChartPanel
        natal={chart}
        presentation="compact"
        description={`ราศีจักรและทักษาของหมวด${category.label}`}
      />

      <ul className="space-y-0.5 px-1">
        {facts.lines.slice(0, 4).map((line) => (
          <li key={line} className="text-[11px] leading-5 text-[var(--muted)]">
            {line}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onAsk(prompt)}
        className="min-h-9 self-start px-1 text-[11px] font-semibold text-[var(--primary)] hover:underline"
      >
        ถามหมวดนี้
      </button>

      <ChartEvidenceTable
        chart={chart}
        mode="natal"
        layout="stack"
        onRowAsk={onAsk}
      />
    </div>
  );
}

function NatalDossierMessage({
  title,
  message,
  actionHref,
  actionLabel,
  onRetry,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="px-2 py-4 text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{message}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)]"
          >
            โหลดอีกครั้ง
          </button>
        ) : null}
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)]"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
