"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fieldDiff } from "./form-utils";
import { Badge, Button, ConfirmDialog } from "./ui";

export type ContentRevision = {
  id: string;
  version: number;
  action: "DRAFT_SAVE" | "PUBLISH" | "RESTORE";
  createdAt: string;
  admin: { email: string; name: string | null };
  note: string | null;
  snapshotJson?: Record<string, unknown> | null;
};

const ACTION_LABEL: Record<ContentRevision["action"], string> = {
  DRAFT_SAVE: "บันทึกแบบร่าง",
  PUBLISH: "เผยแพร่",
  RESTORE: "กู้คืน",
};

/**
 * Unified draft → preview → publish toolbar for all CMS content screens.
 */
export function ContentEditorToolbar({
  hasDraft,
  dirty,
  previewHref,
  busy,
  onSaveDraft,
  onPublish,
  onDiscardDraft,
  onEnablePreview,
  revisions,
  onRestore,
  currentSnapshot,
}: {
  hasDraft: boolean;
  dirty?: boolean;
  previewHref?: string;
  busy?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onDiscardDraft?: () => void;
  /** Optional: enable cookie preview then open previewHref. */
  onEnablePreview?: () => Promise<void>;
  revisions?: ContentRevision[];
  onRestore?: (revisionId: string, mode: "draft" | "publish") => void;
  /** Current published/draft for field-level diff against revision snapshot. */
  currentSnapshot?: Record<string, unknown> | null;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{
    id: string;
    mode: "draft" | "publish";
  } | null>(null);
  const [diffRevId, setDiffRevId] = useState<string | null>(null);
  const [diffSnapshot, setDiffSnapshot] = useState<Record<string, unknown> | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!diffRevId) {
      setDiffSnapshot(null);
      return;
    }
    let alive = true;
    setDiffLoading(true);
    fetch(`/api/admin/revisions/${diffRevId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive) return;
        const snap = json?.data?.snapshotJson;
        setDiffSnapshot(
          snap && typeof snap === "object" ? (snap as Record<string, unknown>) : null,
        );
      })
      .catch(() => {
        if (alive) setDiffSnapshot(null);
      })
      .finally(() => {
        if (alive) setDiffLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [diffRevId]);

  const diffs = useMemo(() => {
    if (!diffRevId || !diffSnapshot) return [];
    return fieldDiff(currentSnapshot ?? null, diffSnapshot);
  }, [currentSnapshot, diffSnapshot, diffRevId]);

  async function handlePreview() {
    if (!previewHref) return;
    setPreviewBusy(true);
    setPreviewError(null);
    try {
      if (onEnablePreview) {
        await onEnablePreview();
      } else {
        const res = await fetch("/api/admin/preview/enable", { method: "POST" });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: { message?: string };
        } | null;
        if (!res.ok || json?.ok === false) {
          throw new Error(
            json?.error?.message ?? "เปิดโหมดดูตัวอย่างไม่สำเร็จ",
          );
        }
      }
      window.open(previewHref, "_blank", "noopener,noreferrer");
    } catch (e) {
      setPreviewError(
        e instanceof Error ? e.message : "เปิดโหมดดูตัวอย่างไม่สำเร็จ",
      );
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {hasDraft && <Badge tone="gold">มีแบบร่าง</Badge>}
        {dirty && <Badge tone="muted">ยังไม่บันทึก</Badge>}
        {previewHref && (
          <button
            type="button"
            onClick={() => void handlePreview()}
            disabled={busy || previewBusy}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--primary)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {previewBusy ? "กำลังเปิด…" : "ดูตัวอย่าง ↗"}
          </button>
        )}
        {previewError && (
          <span className="text-[11px] text-[var(--danger)]">{previewError}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {hasDraft && onDiscardDraft && (
            <Button variant="ghost" onClick={() => setConfirmDiscard(true)} disabled={busy}>
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
          <ul className="mt-2 space-y-2">
            {revisions.map((rev) => (
              <li
                key={rev.id}
                className="rounded-md border border-[var(--border)]/60 bg-[var(--surface-2)]/40 px-2 py-2 text-[11px] text-[var(--muted)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="muted">v{rev.version}</Badge>
                  <span>{ACTION_LABEL[rev.action]}</span>
                  <span>
                    {rev.admin.name ?? rev.admin.email} ·{" "}
                    {new Date(rev.createdAt).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDiffRevId((id) => (id === rev.id ? null : rev.id))
                    }
                  >
                    {diffRevId === rev.id ? "ซ่อน diff" : "ดู diff"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingRestore({ id: rev.id, mode: "draft" })}
                  >
                    กู้เป็นแบบร่าง
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingRestore({ id: rev.id, mode: "publish" })}
                  >
                    กู้และเผยแพร่
                  </Button>
                </div>
                {diffRevId === rev.id && (
                  <div className="mt-2 max-h-40 overflow-auto rounded border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-[10px]">
                    {diffLoading ? (
                      <p>กำลังโหลด diff…</p>
                    ) : diffs.length === 0 ? (
                      <p>ไม่พบความต่างของฟิลด์</p>
                    ) : (
                      diffs.map((d) => (
                        <div key={d.key} className="mb-1 border-b border-[var(--border)]/40 pb-1">
                          <p className="text-[var(--primary)]">{d.key}</p>
                          <p className="text-[var(--danger)]">− {d.before.slice(0, 200)}</p>
                          <p className="text-[var(--secondary-active)]">+ {d.after.slice(0, 200)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-[var(--muted-2)]">
            เคล็ดลับ: กู้เป็นแบบร่างก่อน แล้วค่อยเผยแพร่เมื่อตรวจแล้ว
          </p>
        </details>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="ยกเลิกแบบร่าง?"
        description="แบบร่างจะถูกลบ และกลับไปใช้เวอร์ชันที่เผยแพร่แล้ว"
        confirmLabel="ยกเลิกแบบร่าง"
        danger
        busy={busy}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onDiscardDraft?.();
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        title={
          pendingRestore?.mode === "publish"
            ? "กู้และเผยแพร่ทันที?"
            : "กู้เป็นแบบร่าง?"
        }
        description={
          pendingRestore?.mode === "publish"
            ? "เวอร์ชันนี้จะแทนที่เนื้อหาที่เผยแพร่ทันที — แนะนำให้กู้เป็นแบบร่างก่อนถ้ายังไม่แน่ใจ"
            : "จะโหลดเวอร์ชันนี้เป็นแบบร่าง — ยังไม่เผยแพร่จนกว่าจะกดเผยแพร่"
        }
        confirmLabel={pendingRestore?.mode === "publish" ? "กู้และเผยแพร่" : "กู้เป็นแบบร่าง"}
        danger={pendingRestore?.mode === "publish"}
        busy={busy}
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => {
          if (!pendingRestore) return;
          const { id, mode } = pendingRestore;
          setPendingRestore(null);
          onRestore?.(id, mode);
        }}
      />

      {/* Keep Link for SEO crawlers when JS off — hidden */}
      {previewHref && (
        <Link href={previewHref} className="sr-only">
          preview
        </Link>
      )}
    </div>
  );
}
