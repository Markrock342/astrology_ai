"use client";

import Link from "next/link";
import { isCategoryLocked, useAppData } from "./app-data-provider";
import { CategoryIcon } from "./category-icon";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { HoroscopeChartPanel } from "./horoscope-chart-panel";
import { ChartPreparingIndicator } from "./natal-chart-banner";
import { LockIcon, NatalChartIcon } from "./sidebar-icons";
import { useNatalChart } from "./use-natal-chart";
import {
  askPromptForNatalCategory,
  natalFactsForCategory,
  natalSourceLabel,
  NATAL_FACT_HOUSES,
} from "@/lib/natal-category-facts";
import { dispatchAskFromChart } from "@/lib/chat-navigation-links";
import type { ChartJson } from "@/types/chart";

type Props = {
  onAsk?: () => void;
};

export function NatalDossier({ onAsk }: Props) {
  const { user, categories, repairNatalChart } = useAppData();
  const load = useNatalChart();
  const plan = user?.plan ?? "FREE";

  function ask(prompt: string) {
    dispatchAskFromChart(prompt);
    onAsk?.();
  }

  if (load.status === "pending") {
    return (
      <div className="px-1 py-3">
        <ChartPreparingIndicator onRetry={repairNatalChart} compact />
      </div>
    );
  }

  if (load.status === "failed") {
    return (
      <NatalDossierMessage
        title="ยังเปิดพื้นดวงไม่ได้"
        message={load.message}
        actionHref="/onboarding"
        actionLabel="ตรวจสอบข้อมูลเกิด"
      />
    );
  }

  if (load.status === "loading") {
    return (
      <p className="px-3 py-4 text-xs text-[var(--muted-2)]" role="status">
        กำลังเปิดพื้นดวงที่บันทึกไว้…
      </p>
    );
  }

  if (load.status === "error") {
    return (
      <NatalDossierMessage
        title="โหลดพื้นดวงไม่สำเร็จ"
        message={load.message}
        onRetry={load.retry}
      />
    );
  }

  const chart = load.chart;

  return (
    <div className="flex flex-col gap-3 pb-3">
      <NatalBirthMeta chart={chart} />
      <HoroscopeChartPanel
        natal={chart}
        presentation="compact"
        description="ราศีจักร ทักษา และผังวิเคราะห์ชุดเดียวกับที่ AI ใช้"
      />
      <NatalCategoryList
        chart={chart}
        plan={plan}
        onAsk={ask}
        onNavigate={onAsk}
        categories={categories}
      />
      <ChartEvidenceTable
        chart={chart}
        mode="natal"
        layout="stack"
        onRowAsk={ask}
      />
    </div>
  );
}

function NatalBirthMeta({ chart }: { chart: ChartJson }) {
  const lagna = chart.chart?.lagna ?? chart.meta.lagna;
  return (
    <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--background)]/40 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[var(--primary)]">
        <NatalChartIcon size={14} />
        ดวงจักรกำเนิด
      </p>
      {lagna ? (
        <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
          ลัคนา {lagna}
        </p>
      ) : null}
      <p className="mt-0.5 text-[11px] leading-5 text-[var(--muted)]">
        {chart.meta.birthDisplay}
        {chart.meta.birthDisplay && chart.meta.locationDisplay ? " · " : ""}
        {chart.meta.locationDisplay}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--muted-2)]">
        {natalSourceLabel(chart)}
      </p>
    </div>
  );
}

function NatalCategoryList({
  chart,
  plan,
  onAsk,
  onNavigate,
  categories,
}: {
  chart: ChartJson;
  plan: "FREE" | "PRO";
  onAsk: (prompt: string) => void;
  onNavigate?: () => void;
  categories: ReturnType<typeof useAppData>["categories"];
}) {
  const natalCategories = categories.filter(
    (category) => category.slug in NATAL_FACT_HOUSES,
  );
  if (natalCategories.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wide text-[var(--muted-2)]">
        พื้นดวงตามหมวด
      </p>
      <ul className="flex flex-col gap-1.5">
        {natalCategories.map((category) => {
          const locked = isCategoryLocked(category, plan);
          const facts = natalFactsForCategory(chart, category.slug);
          const prompt =
            category.suggestedQuestions[0] ??
            askPromptForNatalCategory(category.label);

          return (
            <li key={category.slug}>
              <article
                className={`rounded-xl border px-3 py-2.5 ${
                  locked
                    ? "border-[var(--border)] bg-[var(--surface-2)]/50"
                    : "border-[var(--border)] bg-[var(--surface-2)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                    <span className="shrink-0 text-[var(--primary)]">
                      <CategoryIcon slug={category.slug} icon={category.icon} />
                    </span>
                    {category.label}
                    {locked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-[var(--muted-2)]">
                        <LockIcon size={11} />
                        Pro
                      </span>
                    ) : null}
                  </p>
                </div>
                {locked ? (
                  <p className="mt-1.5 text-[11px] leading-5 text-[var(--muted-2)]">
                    หมวดนี้เปิดเมื่อเป็น Pro
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-0.5">
                    {facts.lines.slice(0, 4).map((line) => (
                      <li
                        key={line}
                        className="text-[11px] leading-5 text-[var(--muted)]"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                {locked ? (
                  <Link
                    href="/account"
                    onClick={onNavigate}
                    className="mt-2 inline-flex min-h-9 items-center text-[11px] font-semibold text-[var(--primary)] hover:underline"
                  >
                    ปลดล็อกด้วย Pro
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAsk(prompt)}
                    className="mt-2 min-h-9 text-[11px] font-semibold text-[var(--primary)] hover:underline"
                  >
                    ถามหมวดนี้
                  </button>
                )}
              </article>
            </li>
          );
        })}
      </ul>
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
