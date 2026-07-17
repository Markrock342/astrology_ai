"use client";

import { useEffect, useState } from "react";
import { ExpandableRasiWheel } from "./expandable-rasi-wheel";
import { useAppData } from "./app-data-provider";
import type { ChartJson } from "@/types/chart";

/**
 * Silent chart strip: show wheel when ready.
 * Status comes from bootstrap; full chart JSON fetched only when READY.
 */
export function NatalChartBanner() {
  const { natalChartStatus } = useAppData();
  const [chartJson, setChartJson] = useState<ChartJson | null>(null);

  useEffect(() => {
    if (natalChartStatus?.status !== "READY") return;
    let alive = true;
    fetch("/api/me/natal-chart")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json?.ok) return;
        setChartJson(json.data.chart?.chartJson ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [natalChartStatus?.status]);

  if (!natalChartStatus) return null;

  if (natalChartStatus.status === "READY" && chartJson) {
    return (
      <div className="animate-fade-in mb-6 flex justify-center">
        <ExpandableRasiWheel
          chart={chartJson}
          size={160}
          label="พื้นดวงเดิม"
        />
      </div>
    );
  }

  if (natalChartStatus.status === "PENDING") {
    return (
      <div className="mb-4 text-center text-[11px] text-[var(--muted-2)]">
        …
      </div>
    );
  }

  if (natalChartStatus.status === "FAILED") {
    return (
      <div className="mb-4 text-center text-[11px] text-[var(--danger)]">
        คำนวณพื้นดวงไม่สำเร็จ กรุณาตรวจสอบข้อมูลวันเกิดแล้วลองใหม่
      </div>
    );
  }

  return null;
}
