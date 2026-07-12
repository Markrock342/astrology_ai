"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "./ui";

type ProviderAlert = {
  kind: "BILLING" | "QUOTA" | "KEY";
  title: string;
  message: string;
  actionUrl: string;
  sampleErrorCode: string | null;
};

/** Sticky critical banner when Gemini wallet/quota is failing. */
export function ProviderAlertBanner() {
  const [alert, setAlert] = useState<ProviderAlert | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await adminFetch<{ alert: ProviderAlert | null }>(
          "/api/admin/provider-alert",
        );
        if (alive) setAlert(data.alert);
      } catch {
        /* ignore — banner is best-effort */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!alert) return null;

  return (
    <div className="border-b border-red-500/40 bg-red-950/80 px-4 py-3 text-sm text-red-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-red-50">⚠ {alert.title}</p>
          <p className="mt-0.5 text-xs text-red-100/90">{alert.message}</p>
          {alert.sampleErrorCode ? (
            <p className="mt-1 font-mono text-[10px] text-red-200/70">
              {alert.sampleErrorCode}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={alert.actionUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400"
          >
            เปิด AI Studio Billing
          </a>
          <Link
            href="/admin/ai-configs"
            className="rounded-lg border border-red-400/50 px-3 py-1.5 text-xs text-red-100 hover:bg-red-900/50"
          >
            สถานะ AI
          </Link>
        </div>
      </div>
    </div>
  );
}
