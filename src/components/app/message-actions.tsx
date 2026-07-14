"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CopyMessageButton } from "./copy-message-button";

type FeedbackValue = "up" | "down";

type MessageActionsProps = {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  canEdit?: boolean;
  canRegenerate?: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  failed?: boolean;
  /** Local thumbs until BE feedback API ships. */
  feedback?: FeedbackValue | null;
  onFeedback?: (value: FeedbackValue) => void;
};

/** ChatGPT-style hover actions; collapses to ⋯ on small screens. */
export function MessageActions({
  role,
  content,
  messageId,
  canEdit,
  canRegenerate,
  onEdit,
  onRegenerate,
  onRetry,
  failed,
  feedback,
  onFeedback,
}: MessageActionsProps) {
  if (!content.trim() && !failed) return null;

  const showThumbs = role === "assistant" && Boolean(onFeedback) && !failed;

  return (
    <>
      {/* Desktop / tablet — inline actions.
          data-testid: these buttons only render once the message carries a real
          server id, so E2E asserts on them to prove the id was bound. Several
          labels (ลองใหม่) also appear on the chat-wide ErrorBanner — the testid
          is what tells the two apart. */}
      <div
        data-testid="message-actions"
        className="mt-2 hidden flex-wrap items-center gap-0.5 opacity-100 transition md:flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      >
        <CopyMessageButton text={content} />
        {role === "user" && canEdit && onEdit ? (
          <ActionButton label="แก้ไข" onClick={onEdit} />
        ) : null}
        {role === "assistant" && canRegenerate && onRegenerate ? (
          <ActionButton label="สร้างใหม่" onClick={onRegenerate} />
        ) : null}
        {failed && onRetry ? (
          <ActionButton label="ลองใหม่" onClick={onRetry} />
        ) : null}
        {showThumbs ? (
          <ThumbsButtons
            feedback={feedback ?? null}
            onFeedback={onFeedback!}
          />
        ) : null}
      </div>

      {/* Mobile — overflow menu so the thread stays clean */}
      <div className="mt-2 flex items-center gap-1 md:hidden">
        <CopyMessageButton text={content} />
        {showThumbs ? (
          <ThumbsButtons
            feedback={feedback ?? null}
            onFeedback={onFeedback!}
          />
        ) : null}
        <MobileOverflowMenu
          messageId={messageId}
          canEdit={Boolean(role === "user" && canEdit && onEdit)}
          canRegenerate={Boolean(
            role === "assistant" && canRegenerate && onRegenerate,
          )}
          canRetry={Boolean(failed && onRetry)}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
          onRetry={onRetry}
        />
      </div>
    </>
  );
}

function ThumbsButtons({
  feedback,
  onFeedback,
}: {
  feedback: FeedbackValue | null;
  onFeedback: (value: FeedbackValue) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onFeedback("up")}
        className={`press-scale inline-flex items-center rounded-lg px-2 py-1 text-[11px] transition hover:bg-[var(--surface-2)] ${
          feedback === "up"
            ? "text-[var(--primary)]"
            : "text-[var(--muted-2)] hover:text-[var(--foreground)]"
        }`}
        aria-label="คำตอบดี"
        aria-pressed={feedback === "up"}
        title="มีประโยชน์"
      >
        <ThumbIcon up />
      </button>
      <button
        type="button"
        onClick={() => onFeedback("down")}
        className={`press-scale inline-flex items-center rounded-lg px-2 py-1 text-[11px] transition hover:bg-[var(--surface-2)] ${
          feedback === "down"
            ? "text-[var(--danger)]"
            : "text-[var(--muted-2)] hover:text-[var(--foreground)]"
        }`}
        aria-label="คำตอบไม่ดี"
        aria-pressed={feedback === "down"}
        title="ไม่ค่อยตรง"
      >
        <ThumbIcon up={false} />
      </button>
    </span>
  );
}

function MobileOverflowMenu({
  messageId,
  canEdit,
  canRegenerate,
  canRetry,
  onEdit,
  onRegenerate,
  onRetry,
}: {
  messageId?: string;
  canEdit: boolean;
  canRegenerate: boolean;
  canRetry: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canEdit && !canRegenerate && !canRetry) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press-scale inline-flex size-8 items-center justify-center rounded-lg text-[var(--muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        aria-label="เมนูข้อความ"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-message-id={messageId}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 z-30 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {canEdit && onEdit ? (
            <MenuItem
              label="แก้ไข"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            />
          ) : null}
          {canRegenerate && onRegenerate ? (
            <MenuItem
              label="สร้างใหม่"
              onClick={() => {
                setOpen(false);
                onRegenerate();
              }}
            />
          ) : null}
          {canRetry && onRetry ? (
            <MenuItem
              label="ลองใหม่"
              onClick={() => {
                setOpen(false);
                onRetry();
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-xs text-[var(--foreground)] transition hover:bg-[var(--surface-2)]"
    >
      {label}
    </button>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press-scale inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--muted-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
    >
      {label}
    </button>
  );
}

function ThumbIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={up ? undefined : "rotate-180"}
    >
      <path
        d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3m0 11V11m0 11h7.5a2.5 2.5 0 0 0 2.45-2l1.3-8A2 2 0 0 0 16.3 9H14l.8-3.2A2 2 0 0 0 12.9 3.2L9 8v14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
