"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChartJson } from "@/types/chart";
import { useAppData } from "./app-data-provider";

export type NatalChartLoad =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "failed"; message: string }
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; chart: ChartJson };

/**
 * Saved natal chart for the signed-in user.
 * Pass `enabled: false` until the sidebar icon is tapped so we don't load
 * the full atlas on every dashboard visit.
 */
export function useNatalChart(opts?: { enabled?: boolean }): NatalChartLoad {
  const enabled = opts?.enabled ?? true;
  const { natalChartStatus } = useAppData();
  const [chart, setChart] = useState<ChartJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fetchedKey, setFetchedKey] = useState(-1);

  const retry = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (natalChartStatus?.status !== "READY") return;
    const controller = new AbortController();
    const key = reloadKey;

    void fetch("/api/me/natal-chart", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        const next = json?.data?.chart?.chartJson as ChartJson | undefined;
        if (!response.ok || !json?.ok || !next) {
          throw new Error(json?.error?.message ?? "ไม่พบข้อมูลดวงจักรกำเนิด");
        }
        setChart(next);
        setError(null);
        setFetchedKey(key);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "โหลดดวงจักรกำเนิดไม่สำเร็จ",
        );
        setFetchedKey(key);
      });

    return () => controller.abort();
  }, [enabled, natalChartStatus?.status, reloadKey]);

  if (!enabled) return { status: "idle" };

  if (natalChartStatus?.status === "FAILED") {
    return {
      status: "failed",
      message:
        "คำนวณดวงจักรกำเนิดไม่สำเร็จ กรุณาตรวจสอบวัน เวลา และสถานที่เกิด",
    };
  }

  if (natalChartStatus?.status !== "READY") {
    return { status: "pending" };
  }

  if (fetchedKey !== reloadKey) return { status: "loading" };
  if (error) return { status: "error", message: error, retry };
  if (chart) return { status: "ready", chart };
  return { status: "loading" };
}
