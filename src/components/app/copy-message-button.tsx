"use client";

import { useState } from "react";

/** Small copy control for assistant replies (ChatGPT-style actions). */
export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const value = text.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore — clipboard may be denied
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="press-scale inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      aria-label={copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}
    >
      {copied ? (
        <>
          <CheckIcon />
          คัดลอกแล้ว
        </>
      ) : (
        <>
          <CopyIcon />
          คัดลอก
        </>
      )}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5 9.5 17 19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
