"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChartJson } from "@/types/chart";
import { useAppData } from "./app-data-provider";

export type NatalChartLoad =
  | { status: "pending" }
  | { status: "failed"; message: string }
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; chart: ChartJson };

/**
 * Saved natal chart for the signed-in user.
 * Status comes from bootstrap; full JSON is fetched only when READY.
 */
export function useNatalChart(): NatalChartLoad {
  const { natalChartStatus } = useAppData();
  const [loadState, setLoadState] = useState<
    | { status: "loading" }
    | { status: "ready"; chart: ChartJson }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setLoadState({ status: "loading" });
    setReloadKey((key) => key + 1);
  }, []);

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

  if (loadState.status === "loading") return { status: "loading" };
  if (loadState.status === "error") {
    return { status: "error", message: loadState.message, retry };
  }
  return { status: "ready", chart: loadState.chart };
}
