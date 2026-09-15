"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./use-dialog-focus";
import {
  TRANSIT_DATE_PRESETS,
  transitDateKeyFromPreset,
  transitDateLabelFromKey,
} from "@/lib/transit-date-pick";
import { bangkokDateKey } from "@/lib/reading-intent";

function subscribeToHydration() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function FutureDateModal({
  question,
  initialDate,
  onConfirm,
  onCancel,
}: {
  question: string;
  initialDate: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(initialDate || bangkokDateKey());
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

  useDialogFocus({
    open: hydrated,
    dialogRef,
    onClose: onCancel,
    initialFocusRef: inputRef,
  });

  if (!hydrated) return null;

  const dateLabel = transitDateLabelFromKey(date);

  return createPortal(
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="animate-fade-up w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_20px_55px_var(--shadow-color)] outline-none"
      >
        <h2 id={titleId} className="text-base font-semibold text-[var(--foreground)]">
          เลือกวันที่ที่ต้องการดูดวงจร
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--muted)]">
          ระบบพบว่าคำถามนี้เกี่ยวกับอนาคต กรุณายืนยันวันที่อ้างอิงก่อนส่งให้ AI
        </p>

        <p className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm leading-6 text-[var(--foreground)]">
          “{question}”
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(date);
          }}
        >
          <label className="mt-4 block text-xs font-medium text-[var(--foreground)]">
            วันที่ต้องการถาม
            <input
              ref={inputRef}
              type="date"
              required
              min={bangkokDateKey()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-sm tabular-nums text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          {dateLabel ? (
            <p className="mt-1.5 text-xs text-[var(--muted)]">{dateLabel}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="วันที่แนะนำ">
            {TRANSIT_DATE_PRESETS.map((preset) => (
              <button
                key={preset.kind}
                type="button"
                onClick={() => setDate(transitDateKeyFromPreset(preset.kind))}
                className="min-h-9 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            >
              กลับไปแก้คำถาม
            </button>
            <button
              type="submit"
              disabled={!date}
              className="min-h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ยืนยันวันที่และถาม
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
