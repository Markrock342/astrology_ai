"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Styled confirm dialog — replaces the native window.confirm() so destructive
 * actions (delete chat, clear history) read like the rest of the app instead
 * of a browser chrome popup. Backdrop click and Esc cancel; Enter confirms.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "ตกลง",
  cancelLabel = "ยกเลิก",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Enter" && !busy) onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="animate-fade-up w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        {message ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {message}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="press-scale rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`press-scale rounded-xl px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-60 ${
              danger
                ? "bg-[var(--danger)] hover:opacity-90"
                : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            }`}
          >
            {busy ? "กำลังทำ…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
