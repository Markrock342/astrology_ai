"use client";

import { useEffect, useState } from "react";
import { ExpandableRasiWheel } from "./expandable-rasi-wheel";
import type { ChartJson } from "@/types/chart";

type NatalChartRow = {
  status: "PENDING" | "READY" | "FAILED";
  note?: string | null;
  chartJson?: ChartJson | null;
};

/**
 * Silent chart strip: show wheel when ready.
 * Only show short status text for PENDING/FAILED (actionable).
 */
export function NatalChartBanner() {
  const [chart, setChart] = useState<NatalChartRow | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/natal-chart")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json?.ok) return;
        setChart(json.data.chart ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!chart) return null;

  if (chart.status === "READY" && chart.chartJson) {
    return (
      <div className="animate-fade-in mb-6 flex justify-center">
        <ExpandableRasiWheel
          chart={chart.chartJson}
          size={160}
          label="พื้นดวงเดิม"
        />
      </div>
    );
  }

  if (chart.status === "PENDING") {
    return (
      <div className="mb-4 text-center text-[11px] text-[var(--muted-2)]">
        …
      </div>
    );
  }

  if (chart.status === "FAILED") {
    return (
      <div className="mb-4 text-center text-[11px] text-[var(--danger)]">
        {chart.note ?? "คำนวณไม่สำเร็จ"}
      </div>
    );
  }

  return null;
}
