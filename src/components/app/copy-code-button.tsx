"use client";

import { useState } from "react";

/** Copy control for a single fenced code block. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const value = code.trimEnd();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied */
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="press-scale rounded-md px-2 py-1 text-[10px] text-[var(--muted-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
      aria-label={copied ? "คัดลอกโค้ดแล้ว" : "คัดลอกโค้ด"}
    >
      {copied ? "คัดลอกแล้ว" : "คัดลอก"}
    </button>
  );
}
