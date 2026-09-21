"use client";

import { useId, useState } from "react";

/**
 * The chart atlas, folded away by default.
 *
 * It used to open above every answer and pushed the reading itself off the
 * screen — readers said they come for the ทำนาย and will look at the wheel and
 * the star table only when they want to. One slim row now says what is inside
 * and opens it on tap.
 */
export function ChartDisclosure({
  lagna,
  children,
}: {
  /** Shown on the closed row, because it is the one fact people scan for. */
  lagna?: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="press-scale flex w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--primary)]/45"
      >
        <span className="shrink-0 text-xs font-semibold text-[var(--primary)]">
          ตารางดาว
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-[10px] text-[var(--primary)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
        {lagna ? (
          <span className="min-w-0 truncate text-[11px] text-[var(--muted)]">
            ลัคนา {lagna}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-[11px] text-[var(--muted-2)]">
          {open ? "ซ่อน" : "แตะเพื่อดู"}
        </span>
      </button>
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-[var(--ease-out-quart)] ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}
