"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./use-dialog-focus";

/**
 * Styled confirm dialog — replaces the native window.confirm() so destructive
 * actions (delete chat, clear history) read like the rest of the app instead
 * of a browser chrome popup. Backdrop click and Esc cancel. Enter only confirms
 * when the confirm button itself is focused (native button activation).
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Destructive dialogs land on Cancel; the rest on the first control.
  useDialogFocus({
    open,
    dialogRef,
    onClose: onCancel,
    busy,
    initialFocusRef: danger ? cancelRef : undefined,
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="animate-fade-up w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-2xl outline-none"
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
            ref={cancelRef}
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
            className={`press-scale rounded-xl px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
              danger
                ? "bg-[var(--danger)] text-[var(--danger-foreground)] hover:opacity-90"
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

/**
 * Text-input rename dialog — replaces window.prompt for thread titles.
 * Mount fresh per open (parent unmounts when closed) so title state resets.
 */
export function ThreadRenameModal({
  initialTitle,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: {
  initialTitle: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDialogFocus({
    open: true,
    dialogRef,
    onClose: onCancel,
    busy,
    initialFocusRef: inputRef,
    selectInitial: true,
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="animate-fade-up w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-label="ตั้งชื่อแชทใหม่"
      >
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          ตั้งชื่อแชทใหม่
        </h3>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) onSubmit(title);
          }}
        >
          <label
            htmlFor="thread-title"
            className="text-xs text-[var(--muted)]"
          >
            ชื่อใหม่
          </label>
          <input
            id="thread-title"
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            disabled={busy}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:opacity-60"
            placeholder="เช่น งานที่เหมาะกับฉัน"
            aria-label="ชื่อแชทใหม่"
          />
          {error ? (
            <p className="text-xs text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="press-scale rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)] disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="press-scale rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-60"
            >
              {busy ? "กำลังบันทึก…" : "บันทึกชื่อ"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
