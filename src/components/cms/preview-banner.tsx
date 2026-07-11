"use client";

import { useState } from "react";

/** Yellow bar shown when CMS preview cookie is active. */
export function PreviewBanner() {
  const [busy, setBusy] = useState(false);

  async function exitPreview() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/admin/preview/enable", { method: "DELETE" });
    } catch {
      // Still reload so a stale UI isn't stuck in preview chrome.
    }
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span>โหมดตัวอย่าง — ยังไม่เผยแพร่</span>
      <button
        type="button"
        onClick={exitPreview}
        disabled={busy}
        className="rounded-full bg-amber-950/90 px-3 py-1 text-xs font-semibold text-amber-50 transition hover:bg-amber-950 disabled:opacity-60"
      >
        {busy ? "กำลังออก…" : "ออกจากโหมดตัวอย่าง"}
      </button>
    </div>
  );
}
