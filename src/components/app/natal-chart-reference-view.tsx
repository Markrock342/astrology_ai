"use client";

import { useEffect, useState } from "react";
import type { ChartJson } from "@/types/chart";
import { ChartEvidenceTable } from "./chart-evidence-table";
import { HoroscopeChartPanel } from "./horoscope-chart-panel";
import { useAppData } from "./app-data-provider";
import { NatalChartIcon } from "./sidebar-icons";
import { ChartPreparingIndicator } from "./natal-chart-banner";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; chart: ChartJson }
  | { status: "error"; message: string };

function sourceLabel(chart: ChartJson): string {
  return chart.meta.calculationSource === "myhora-scrape"
    ? "สมผุสและองศาจากตารางโหราศาสตร์ไทย"
    : "คำนวณจากสูตรสุริยยาตร์–ลาหิรี";
}

export function NatalChartReferenceView() {
  const { natalChartStatus, repairNatalChart } = useAppData();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (natalChartStatus?.status !== "READY") return;
    const controller = new AbortController();

    void fetch("/api/me/natal-chart", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        const chart = json?.data?.chart?.chartJson as ChartJson | undefined;
        if (!response.ok || !json?.ok || !chart) {
          throw new Error(json?.error?.message ?? "ไม่พบข้อมูลดวงจักรกำเนิด");
        }
        setLoadState({ status: "ready", chart });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "โหลดดวงจักรกำเนิดไม่สำเร็จ",
        });
      });

    return () => controller.abort();
  }, [natalChartStatus?.status, reloadKey]);

  if (natalChartStatus?.status === "PENDING" || !natalChartStatus) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center pt-16 text-center">
        <ChartPreparingIndicator onRetry={repairNatalChart} />
      </div>
    );
  }

  if (natalChartStatus.status === "FAILED") {
    return (
      <ChartUnavailableState
        message="คำนวณดวงจักรกำเนิดไม่สำเร็จ กรุณาตรวจสอบวัน เวลา และสถานที่เกิด"
      />
    );
  }

  if (loadState.status === "loading") {
    return <ChartLoadingState label="กำลังเปิดดวงที่บันทึกไว้…" />;
  }

  if (loadState.status === "error") {
    return (
      <ChartUnavailableState
        message={loadState.message}
        onRetry={() => {
          setLoadState({ status: "loading" });
          setReloadKey((key) => key + 1);
        }}
      />
    );
  }

  const chart = loadState.chart;

  return (
    <div className="page-enter mx-auto w-full max-w-5xl pb-10">
      <header className="mb-7 flex flex-col gap-5 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--primary)]">
            <NatalChartIcon size={16} />
            ข้อมูลประจำดวง
          </p>
          <h1 className="text-2xl font-semibold leading-tight text-[var(--foreground)] sm:text-3xl">
            ดวงจักรกำเนิด
          </h1>
          <p className="mt-3 max-w-[68ch] text-sm leading-6 text-[var(--muted)]">
            ผังนี้สร้างจากข้อมูลเกิดที่บันทึกไว้ และเป็นข้อมูลชุดเดียวกับที่ระบบส่งให้ AI
            พร้อมคลังความรู้หลังบ้านเพื่อสรุปคำตอบในแต่ละหมวด
          </p>
        </div>
        <div className="shrink-0 text-left text-xs leading-5 text-[var(--muted-2)] sm:text-right">
          <p>{chart.meta.birthDisplay}</p>
          <p>{chart.meta.locationDisplay}</p>
          <p className="mt-1 text-[var(--primary)]">{sourceLabel(chart)}</p>
        </div>
      </header>

      <HoroscopeChartPanel
        natal={chart}
        presentation="reference"
        description="ตำแหน่งลัคนา ดาว เรือน นวางศ์ ตรียางศ์ และทักษา ชุดเดียวกับที่ใช้วิเคราะห์คำตอบ"
      />

      <div className="mt-5">
        <ChartEvidenceTable chart={chart} mode="natal" defaultOpen />
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
        <p className="max-w-xl text-xs leading-5 text-[var(--muted-2)]">
          กราฟจะยังอยู่หลังออกจากระบบ เพราะโหลดจากพื้นดวงที่บันทึกในบัญชี ไม่ได้ผูกกับคำตอบ AI รอบใดรอบหนึ่ง
        </p>
        <a
          href="/dashboard?cat=self"
          className="press-scale rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-4 py-2 text-xs font-semibold text-[var(--primary)] transition hover:border-[var(--primary)]"
        >
          ไปอ่านหมวดตัวตน
        </a>
      </div>
    </div>
  );
}

function ChartLoadingState({ label }: { label: string }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 pt-20 text-center">
      <span className="animate-pulse text-[var(--primary)]" aria-hidden>
        <NatalChartIcon size={38} />
      </span>
      <p className="text-sm text-[var(--muted)]" role="status">
        {label}
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
