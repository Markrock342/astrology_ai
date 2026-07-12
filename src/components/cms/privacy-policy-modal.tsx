"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SimpleMarkdown } from "@/components/cms/simple-markdown";
import type { CmsDocument } from "@/lib/cms-keys";

/** Full privacy policy in a dismissible modal (no navigation). */
export function PrivacyPolicyModal({
  doc,
  open,
  onClose,
}: {
  doc: CmsDocument;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-up flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="privacy-modal-title"
              className="text-base font-semibold text-[var(--foreground)]"
            >
              {doc.title}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--muted-2)]">
              ปรับปรุงล่าสุด: {doc.lastUpdated}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            <SimpleMarkdown text={doc.intro} />
          </p>
          <div className="mt-6 flex flex-col gap-6">
            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {section.heading}
                </h3>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
                  {section.body.map((line, i) => (
                    <li
                      key={i}
                      className="text-sm leading-relaxed text-[var(--muted)]"
                    >
                      <SimpleMarkdown text={line} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {doc.footer ? (
            <p className="mt-6 text-xs text-[var(--muted-2)]">{doc.footer}</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Turn "นโยบาย…" inside consent copy into a modal trigger (no redirect). */
export function PrivacyConsentText({
  text,
  onOpenPolicy,
}: {
  text: string;
  onOpenPolicy: () => void;
}) {
  const parts = text.split(/(นโยบาย(?:ความเป็นส่วนตัว)?)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("นโยบาย") ? (
          <button
            key={i}
            type="button"
            className="text-[var(--primary)] underline underline-offset-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenPolicy();
            }}
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
