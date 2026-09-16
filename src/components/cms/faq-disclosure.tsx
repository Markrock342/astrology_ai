"use client";

import { useId, useState } from "react";

/**
 * FAQ row that opens smoothly: the answer's height is animated with a
 * 0fr → 1fr grid track (transform-free, no layout thrash), so the rows below
 * glide down instead of jumping. A native <details> snaps open and the whole
 * page reflows at once — the client found that hard on the eyes.
 */
export function FaqDisclosure({
  question,
  children,
  variant = "line",
}: {
  question: string;
  children: React.ReactNode;
  /** `line`: divider rows (landing teaser). `card`: bordered card (FAQ page). */
  variant?: "line" | "card";
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const shell =
    variant === "card"
      ? "rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 transition-colors duration-200 hover:border-[var(--primary)]/40"
      : "border-t border-[var(--border)]";

  return (
    <div className={shell}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-start justify-between gap-4 text-left text-sm font-medium text-[var(--foreground)] ${
          variant === "card" ? "py-3.5" : "py-4 sm:text-base"
        }`}
      >
        <span>{question}</span>
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 text-[var(--primary)] transition-transform duration-300 ease-[var(--ease-out-quart)] ${
            open ? "rotate-45" : ""
          }`}
        >
          +
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
          <div
            className={`max-w-[65ch] pb-5 text-sm leading-relaxed text-[var(--muted)] transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
