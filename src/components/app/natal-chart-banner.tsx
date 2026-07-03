"use client";

import { useEffect, useState } from "react";

type NatalChartRow = {
  status: "PENDING" | "READY" | "FAILED";
  note?: string | null;
  computedAt?: string | null;
};

const STATUS_LABEL: Record<NatalChartRow["status"], string> = {
  PENDING: "กำลังเตรียมพื้นดวงเดิม",
  READY: "พื้นดวงเดิมพร้อมแล้ว",
  FAILED: "คำนวณพื้นดวงไม่สำเร็จ",
};

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

  return (
    <div className="animate-fade-in mx-auto mb-4 max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--muted)]">
      <p className="font-medium text-[var(--foreground)]">{STATUS_LABEL[chart.status]}</p>
      {chart.note && <p className="mt-1 leading-relaxed">{chart.note}</p>}
    </div>
  );
}
