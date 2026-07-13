"use client";

import { CopyMessageButton } from "./copy-message-button";

type MessageActionsProps = {
  role: "user" | "assistant";
  content: string;
  canEdit?: boolean;
  canRegenerate?: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  failed?: boolean;
};

/** ChatGPT-style hover actions on a message bubble. */
export function MessageActions({
  role,
  content,
  canEdit,
  canRegenerate,
  onEdit,
  onRegenerate,
  onRetry,
  failed,
}: MessageActionsProps) {
  if (!content.trim() && !failed) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
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
    </div>
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
