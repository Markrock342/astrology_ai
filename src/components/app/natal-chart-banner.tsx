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
  const { natalChartStatus, repairNatalChart } = useAppData();
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
      <ChartPreparingIndicator onRetry={repairNatalChart} />
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

export function ChartPreparingIndicator({
  onRetry,
  compact = false,
}: {
  onRetry?: () => Promise<void> | void;
  compact?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function retry() {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? "mb-0 gap-2" : "mb-5 gap-3"}`}
      role="status"
      aria-live="polite"
    >
      <div className={`relative ${compact ? "size-20" : "size-28"}`} aria-hidden>
        <span className="absolute inset-0 rounded-full border border-[var(--primary)]/25" />
        <span className="absolute inset-2 animate-spin rounded-full border border-transparent border-t-[var(--primary)] border-r-[var(--primary)]/45 [animation-duration:2.4s]" />
        <span className="absolute inset-[28%] rounded-full border border-[var(--primary)]/35 bg-[var(--primary)]/5" />
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-[var(--primary)]"
            style={{
              transform: `translate(-50%, -50%) rotate(${index * 90}deg) translateY(-${compact ? 30 : 42}px)`,
              opacity: 1 - index * 0.17,
            }}
          />
        ))}
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--primary)]">
          {elapsed < 8
            ? "กำลังวางลัคนาและตำแหน่งดาว"
            : elapsed < 20
              ? "กำลังตรวจเรือนและองศา"
              : "ใช้เวลานานกว่าปกติ — กำลังลองใหม่ให้อัตโนมัติ"}
        </p>
        <p className="mt-1 text-xs tabular-nums text-[var(--muted-2)]">
          {elapsed} วินาที · เสร็จแล้วหน้านี้จะเปิดสรุปให้เอง
        </p>
      </div>
      {elapsed >= 20 && onRetry ? (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="min-h-11 rounded-xl border border-[var(--primary)]/45 px-4 py-2 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10 disabled:opacity-50"
        >
          {retrying ? "กำลังตรวจ…" : "ตรวจสถานะตอนนี้"}
        </button>
      ) : null}
    </div>
  );
}
