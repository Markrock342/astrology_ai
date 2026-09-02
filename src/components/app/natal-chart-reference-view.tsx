"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { HoroscopeChartPanel } from "./horoscope-chart-panel";
import { isCategoryLocked, useAppData, useCategory } from "./app-data-provider";
import { NatalChartIcon } from "./sidebar-icons";
import { ChartPreparingIndicator } from "./natal-chart-banner";
import { CategoryIcon } from "./category-icon";
import { useNatalChart } from "./use-natal-chart";
import { softNavigate, useChatRouteSearchParams } from "./chat-nav";
import {
  askPromptForNatalCategory,
  natalFactsForCategory,
  natalSourceLabel,
} from "@/lib/natal-category-facts";
import {
  dispatchAskFromChart,
  natalCategoryHref,
} from "@/lib/chat-navigation-links";
import type { Category } from "./nav-data";

const REVEAL_HOLD_MS = 560;

export function NatalChartReferenceView() {
  const searchParams = useChatRouteSearchParams();
  const catSlug = searchParams.get("cat");
  const { user, repairNatalChart } = useAppData();
  const category = useCategory(catSlug);
  const plan = user?.plan ?? "FREE";
  const locked = isCategoryLocked(category, plan);
  const load = useNatalChart();

  if (locked && category) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 pt-20 text-center">
        <span className="text-[var(--primary)]" aria-hidden>
          <CategoryIcon slug={category.slug} icon={category.icon} size={40} />
        </span>
        <h1 className="text-lg font-semibold text-[var(--foreground)]">
          หมวด{category.label}เปิดเมื่อเป็น Pro
        </h1>
        <a
          href="/account"
          className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)]"
        >
          ปลดล็อกด้วย Pro
        </a>
      </div>
    );
  }

  if (load.status === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center pt-16 text-center">
        <ChartPreparingIndicator onRetry={repairNatalChart} />
      </div>
    );
  }

  if (load.status === "failed") {
    return <ChartUnavailableState message={load.message} />;
  }

  if (load.status === "error") {
    return (
      <ChartUnavailableState message={load.message} onRetry={load.retry} />
    );
  }

  if (load.status !== "ready") {
    return <NatalRevealSpinner category={category} />;
  }

  const chart = load.chart;
  const title = category?.label ?? "ดวงจักรกำเนิด";
  const facts = category
    ? natalFactsForCategory(chart, category.slug)
    : null;
  const prompt = category
    ? (category.suggestedQuestions[0] ??
      askPromptForNatalCategory(category.label))
    : "ขอสรุปพื้นดวงจากดวงจักรกำเนิด";

  return (
    <NatalReveal key={catSlug ?? "overview"} category={category}>
      <div className="page-enter mx-auto w-full max-w-5xl pb-10">
      <header className="mb-7 flex flex-col gap-5 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--primary)]">
            {category ? (
              <CategoryIcon slug={category.slug} icon={category.icon} size={16} />
            ) : (
              <NatalChartIcon size={16} />
            )}
            พื้นดวงเดิม
          </p>
          <h1 className="text-2xl font-semibold leading-tight text-[var(--foreground)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 max-w-[68ch] text-sm leading-6 text-[var(--muted)]">
            ผังนี้สร้างจากข้อมูลเกิดที่บันทึกไว้ และเป็นข้อมูลชุดเดียวกับที่ระบบส่งให้ AI
          </p>
        </div>
        <div className="shrink-0 text-left text-xs leading-5 text-[var(--muted-2)] sm:text-right">
          <p>{chart.meta.birthDisplay}</p>
          <p>{chart.meta.locationDisplay}</p>
          <p className="mt-1 text-[var(--primary)]">{natalSourceLabel(chart)}</p>
        </div>
      </header>

      {facts ? (
        <ul className="mb-6 space-y-1 text-sm leading-6 text-[var(--muted)]">
          {facts.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <HoroscopeChartPanel
        natal={chart}
        presentation="reference"
        description="ตำแหน่งลัคนา ดาว เรือน นวางศ์ ตรียางศ์ และทักษา ชุดเดียวกับที่ใช้วิเคราะห์คำตอบ"
      />

      <div className="mt-5">
        <ChartEvidenceTable
          chart={chart}
          mode="natal"
          defaultOpen
          onRowAsk={(next) => {
            dispatchAskFromChart(next);
            softNavigate(catSlug ? natalCategoryHref(catSlug) : "/dashboard");
          }}
        />
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
        <p className="max-w-xl text-xs leading-5 text-[var(--muted-2)]">
          กราฟจะยังอยู่หลังออกจากระบบ เพราะโหลดจากพื้นดวงที่บันทึกในบัญชี
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              dispatchAskFromChart(prompt);
              softNavigate(catSlug ? natalCategoryHref(catSlug) : "/dashboard");
            }}
            className="press-scale rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-4 py-2 text-xs font-semibold text-[var(--primary)] transition hover:border-[var(--primary)]"
          >
            ถามหมวดนี้
          </button>
          <button
            type="button"
            onClick={() => softNavigate("/dashboard")}
            className="press-scale rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)]"
          >
            กลับไปถามดวง
          </button>
        </div>
      </div>
      </div>
    </NatalReveal>
  );
}

function NatalReveal({
  category,
  children,
}: {
  category: Category | undefined;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => setReady(true),
      reduced ? 0 : REVEAL_HOLD_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return <NatalRevealSpinner category={category} />;
  return children;
}

function NatalRevealSpinner({ category }: { category: Category | undefined }) {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 pt-20 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative size-24">
        <span className="absolute inset-0 rounded-full border border-[var(--primary)]/20" />
        <span className="natal-orbit absolute inset-1 rounded-full border border-transparent border-t-[var(--primary)] border-r-[var(--primary)]/40" />
        <span className="absolute inset-[22%] rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/8" />
        <span className="absolute inset-0 flex items-center justify-center text-[var(--primary)]">
          {category ? (
            <CategoryIcon slug={category.slug} icon={category.icon} size={32} />
          ) : (
            <NatalChartIcon size={32} />
          )}
        </span>
      </div>
      <p className="text-sm text-[var(--muted)]">
        {category
          ? `กำลังเปิดพื้นดวงหมวด${category.label}…`
          : "กำลังเปิดดวงจักรกำเนิด…"}
      </p>
    </div>
  );
}

function ChartUnavailableState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 pt-20 text-center">
      <span className="text-[var(--primary)]" aria-hidden>
        <NatalChartIcon size={40} />
      </span>
      <div>
        <h1 className="text-lg font-semibold text-[var(--foreground)]">
          ยังเปิดดวงจักรกำเนิดไม่ได้
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)]"
          >
            โหลดอีกครั้ง
          </button>
        ) : null}
        <a
          href="/onboarding"
          className="press-scale rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)]"
        >
          ตรวจสอบข้อมูลเกิด
        </a>
      </div>
    </div>
  );
}
