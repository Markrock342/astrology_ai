"use client";

import Link from "next/link";
import { Badge, Button } from "./ui";

export type ContentRevision = {
  id: string;
  version: number;
  action: "DRAFT_SAVE" | "PUBLISH" | "RESTORE";
  createdAt: string;
  admin: { email: string; name: string | null };
  note: string | null;
};

const ACTION_LABEL: Record<ContentRevision["action"], string> = {
  DRAFT_SAVE: "บันทึกแบบร่าง",
  PUBLISH: "เผยแพร่",
  RESTORE: "กู้คืน",
};

export function ContentEditorToolbar({
  hasDraft,
  previewHref,
  busy,
  onSaveDraft,
  onPublish,
  onDiscardDraft,
  revisions,
  onRestore,
}: {
  hasDraft: boolean;
  previewHref?: string;
  busy?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onDiscardDraft?: () => void;
  revisions?: ContentRevision[];
  onRestore?: (revisionId: string, mode: "draft" | "publish") => void;
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {hasDraft && <Badge tone="gold">มีแบบร่าง</Badge>}
        {previewHref && (
          <Link
            href={previewHref}
            target="_blank"
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--primary)] hover:bg-[var(--surface-2)]"
          >
            ดูตัวอย่าง ↗
          </Link>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {hasDraft && onDiscardDraft && (
            <Button variant="ghost" onClick={onDiscardDraft} disabled={busy}>
              ยกเลิกแบบร่าง
            </Button>
          )}
          <Button variant="ghost" onClick={onSaveDraft} disabled={busy}>
            {busy ? "กำลังบันทึก…" : "บันทึกแบบร่าง"}
          </Button>
          <Button onClick={onPublish} disabled={busy}>
            {busy ? "กำลังเผยแพร่…" : "เผยแพร่"}
          </Button>
        </div>
      </div>

      {revisions && revisions.length > 0 && onRestore && (
        <details className="rounded-lg border border-[var(--border)] px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
            ประวัติการแก้ไข ({revisions.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]"
              >
                <Badge tone="muted">v{rev.version}</Badge>
                <span>{ACTION_LABEL[rev.action]}</span>
                <span>
                  {rev.admin.name ?? rev.admin.email} ·{" "}
                  {new Date(rev.createdAt).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                  })}
                </span>
                <Button variant="ghost" onClick={() => onRestore(rev.id, "draft")}>
                  กู้เป็นแบบร่าง
                </Button>
                <Button variant="ghost" onClick={() => onRestore(rev.id, "publish")}>
                  กู้และเผยแพร่
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
