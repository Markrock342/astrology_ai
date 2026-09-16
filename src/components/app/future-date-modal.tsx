"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./use-dialog-focus";
import { transitDateLabelFromKey } from "@/lib/transit-date-pick";
import { bangkokDateKey } from "@/lib/reading-intent";
import { TransitDateWheel } from "./transit-date-picker";

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
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <TransitDateWheel
              value={date}
              onChange={setDate}
              onSubmit={(key) => onConfirm(key)}
              hint="วันที่ระบบเสนอมาจากคำถาม — แก้ได้ที่ช่อง พิมพ์ กดชิป หรือหมุนวงล้อ"
            />
          </div>
          {dateLabel ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              จะอ่านดวงจร ณ วันที่ <span className="font-medium text-[var(--foreground)]">{dateLabel}</span>
            </p>
          ) : null}

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
