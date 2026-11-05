"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ContentEditorToolbar,
  type ContentRevision,
} from "./content-editor-toolbar";
import {
  adminFetch,
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from "./ui";
import { KNOWLEDGE_MAX_CHARS } from "@/config/constants";
import { KNOWLEDGE_SOURCE_LABELS, type KnowledgeProvenance, type KnowledgeSource } from "@/lib/knowledge-provenance";
import { adminDay } from "@/lib/admin-dates";
import { ConfirmModal } from "@/components/app/confirm-modal";

type KnowledgeSummary = {
  id: string;
  title: string;
  categoryId: string | null;
  enabled: boolean;
  sortOrder: number;
  draftUpdatedAt: string | null;
  category: { id: string; nameTh: string } | null;
  /** char_length(content) — the body itself is only fetched when opened. */
  contentChars: number;
  provenance?: KnowledgeProvenance;
};

type KnowledgeDoc = KnowledgeSummary & {
  content: string;
  draftTitle: string | null;
  draftContent: string | null;
};

const EMPTY_FORM = {
  title: "",
  content: "",
  categoryId: "",
  enabled: true,
  sortOrder: 0,
};

type Category = { id: string; nameTh: string };

export function KnowledgeManager() {
  const [docs, setDocs] = useState<KnowledgeSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSource | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confirmToggle, setConfirmToggle] = useState<KnowledgeSummary | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLTextAreaElement>(null);
  const pendingRevealRef = useRef(false);

  /** After opening an edit, pin the form to the top of the viewport and
   *  keep the caret/scroll at the start of the body so long docs are readable. */
  function revealEditorAtStart() {
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const area = contentAreaRef.current;
    if (area) {
      area.scrollTop = 0;
      try {
        area.setSelectionRange(0, 0);
      } catch {
        /* some browsers reject setSelectionRange when not focused */
      }
    }
    titleInputRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!pendingRevealRef.current || !showForm) return;
    pendingRevealRef.current = false;
    // Wait one frame so the textarea has the new value painted.
    const id = requestAnimationFrame(() => revealEditorAtStart());
    return () => cancelAnimationFrame(id);
  }, [form.content, showForm, editingId]);

  const loadRevisions = useCallback(async (id: string) => {
    setRevisions(
      await adminFetch<ContentRevision[]>(
        `/api/admin/revisions?entityType=KNOWLEDGE_DOC&entityId=${encodeURIComponent(id)}`,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ds, cats] = await Promise.all([
        adminFetch<KnowledgeSummary[]>("/api/admin/knowledge"),
        adminFetch<Category[]>("/api/admin/categories"),
      ]);
      setDocs(ds);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async data fetch — setState runs after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function startEdit(d: KnowledgeSummary) {
    setEditingId(d.id);
    setShowForm(true);
    setBusy(true);
    setError(null);
    // Jump to the editor immediately (before fetch) so the click on a bottom
    // row doesn't leave the viewport parked on the list.
    requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    try {
      const full = await adminFetch<KnowledgeDoc>(`/api/admin/knowledge/${d.id}`);
      setForm({
        title: full.draftTitle ?? full.title,
        content: full.draftContent ?? full.content,
        categoryId: full.categoryId ?? "",
        enabled: full.enabled,
        sortOrder: full.sortOrder,
      });
      pendingRevealRef.current = true;
      void loadRevisions(d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดเนื้อหาไม่สำเร็จ");
      setShowForm(false);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!editingId) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/knowledge/${editingId}/draft`, {
        method: "PUT",
        body: JSON.stringify({ title: form.title, content: form.content }),
      });
      await load();
      await loadRevisions(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกแบบร่างไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        sortOrder: Number(form.sortOrder),
      };
      if (editingId) {
        await adminFetch(`/api/admin/knowledge/${editingId}/publish`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/api/admin/knowledge", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await load();
      if (editingId) await loadRevisions(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เผยแพร่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision(revisionId: string, mode: "draft" | "publish") {
    if (!editingId) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/revisions/${revisionId}/restore`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      await load();
      const full = await adminFetch<KnowledgeDoc>(`/api/admin/knowledge/${editingId}`);
      setForm({
        title: full.draftTitle ?? full.title,
        content: full.draftContent ?? full.content,
        categoryId: full.categoryId ?? "",
        enabled: full.enabled,
        sortOrder: full.sortOrder,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    await publish();
  }

  async function remove(id: string) {
    if (!window.confirm("ลบเอกสารนี้?")) return;
    try {
      await adminFetch(`/api/admin/knowledge/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  async function toggleEnabled(d: KnowledgeSummary) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await adminFetch<KnowledgeDoc>(`/api/admin/knowledge/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !d.enabled }),
      });
      if (editingId === d.id) setForm(current => ({ ...current, enabled: updated.enabled }));
      setConfirmToggle(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ");
    } finally { setBusy(false); }
  }

  const totalChars = docs
    .filter((d) => d.enabled)
    .reduce((s, d) => s + d.contentChars, 0);
  const visibleDocs = docs.filter(d => (sourceFilter === "ALL" || (d.provenance?.source ?? "UNKNOWN") === sourceFilter)
    && (statusFilter === "ALL" || d.enabled === (statusFilter === "ON")));

  return (
    <AdminPage>
      <PageHeader
        title="คลังความรู้ (Knowledge)"
        description="วางเนื้อหา FAQ/ตำรา ให้ AI ใช้อ้างอิงตอบ — ระบบจะแบ่งเอกสารและค้นเฉพาะส่วนที่ตรงกับคำถาม หมวด และข้อมูลดวง"
        action={
          <Button
            disabled={busy}
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            + เพิ่มเอกสาร
          </Button>
        }
      />

      <p className="mb-4 text-xs text-[var(--muted-2)]">
        คลังที่ค้นได้ {totalChars.toLocaleString()} ตัวอักษร · ส่งเข้า AI สูงสุด{" "}
        {KNOWLEDGE_MAX_CHARS.toLocaleString()} ตัวอักษรที่เกี่ยวข้องต่อคำตอบ
      </p>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="แหล่งที่มา"><Select aria-label="แหล่งที่มาของเอกสาร" value={sourceFilter} onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}>
          <option value="ALL">ทุกแหล่งที่มา</option>{Object.entries(KNOWLEDGE_SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select></Field>
        <Field label="สถานะการใช้งาน"><Select aria-label="สถานะเอกสารความรู้" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="ALL">ทุกสถานะ</option><option value="ON">AI ใช้อ้างอิง</option><option value="OFF">ไม่ส่งให้ AI</option></Select></Field>
        <p className="pb-2 text-xs text-[var(--muted)]">แสดง {visibleDocs.length} / {docs.length} เอกสาร · เปิดใช้งาน {docs.filter(d => d.enabled).length}</p>
      </div>

      {showForm && (
        <div ref={formCardRef}>
        <Card>
          {editingId && (
            <ContentEditorToolbar
              hasDraft={Boolean(docs.find((d) => d.id === editingId)?.draftUpdatedAt)}
              busy={busy}
              onSaveDraft={() => void saveDraft()}
              onPublish={() => void publish()}
              revisions={revisions}
              onRestore={(id, mode) => void restoreRevision(id, mode)}
            />
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="ชื่อเอกสาร">
              <TextInput
                ref={titleInputRef}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="เช่น ความหมายดาวพฤหัสในแต่ละเรือน"
              />
            </Field>
            <Field label="ใช้กับหมวด">
              <Select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">ทุกหมวด</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameTh}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="ลำดับ">
              <TextInput
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="เนื้อหา" hint="วางข้อความ FAQ/ตำราได้เลย (สูงสุด 50,000 ตัวอักษร)">
              <TextArea
                ref={contentAreaRef}
                rows={12}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Toggle
              checked={form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
              label="เปิดใช้งาน"
            />
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => void (editingId ? publish() : save())}
                disabled={busy || !form.title || !form.content}
              >
                {busy ? "กำลังบันทึก…" : editingId ? "เผยแพร่" : "เพิ่มเอกสาร"}
              </Button>
            </div>
          </div>
        </Card>
        </div>
      )}

      {loading && !showForm ? (
        <div className="mt-4 flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
      <div className="mt-4 flex flex-col gap-3">
        {visibleDocs.map((d) => (
          <Card key={d.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{d.title}</span>
              <Badge tone="gold">{d.category?.nameTh ?? "ทุกหมวด"}</Badge>
              <Badge tone={d.enabled ? "green" : "muted"}>{d.enabled ? "AI ใช้อ้างอิง" : "ไม่ส่งให้ AI"}</Badge>
              <Badge tone="muted">{KNOWLEDGE_SOURCE_LABELS[d.provenance?.source ?? "UNKNOWN"]}</Badge>
              {d.draftUpdatedAt ? <Badge tone="gold">มีแบบร่าง</Badge> : null}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmToggle(d)}>
                  <span aria-hidden="true">{d.enabled ? "ปิด" : "เปิด"}</span>
                  <span className="sr-only">{`${d.enabled ? "ปิด" : "เปิด"}การอ้างอิง ${d.title}`}</span>
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => startEdit(d)}>
                  แก้ไข
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => remove(d.id)}>
                  ลบ
                </Button>
              </div>
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-[var(--muted)]">
              {d.provenance?.createdBy && <p>ผู้เพิ่ม: {d.provenance.createdBy}</p>}
              {d.provenance?.source === "SYSTEM_GUIDE" && <p>คู่มือสำหรับตรวจสอบการคำนวณ ไม่จำเป็นต้องเปิดเพื่อให้ AI ใช้อ้างอิง</p>}
              {d.provenance?.statusChangedAt ? <p>บันทึกสถานะล่าสุด {adminDay(d.provenance.statusChangedAt)} โดย {d.provenance.statusChangedBy}{d.provenance.statusReason ? ` · ${d.provenance.statusReason}` : ""}</p>
                : <p>ไม่พบประวัติผู้เปลี่ยนเป็นสถานะปัจจุบัน</p>}
            </div>
          </Card>
        ))}
        {visibleDocs.length === 0 && docs.length > 0 && <p className="text-sm text-[var(--muted)]">ไม่มีเอกสารที่ตรงกับตัวกรอง</p>}
        {docs.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">
            ยังไม่มีเอกสารความรู้ — กด &quot;+ เพิ่มเอกสาร&quot; แล้ววางเนื้อหา FAQ/ตำราได้เลย
          </p>
        )}
      </div>
      )}
      <ConfirmModal open={confirmToggle !== null} busy={busy} danger={Boolean(confirmToggle?.enabled)}
        title={confirmToggle?.enabled ? "หยุดใช้เอกสารนี้ตอบคำถาม?" : "ให้ AI ใช้เอกสารนี้อ้างอิง?"}
        message={confirmToggle ? `${confirmToggle.title}\n${confirmToggle.enabled ? "เนื้อหาจะยังอยู่ในคลัง แต่จะไม่ส่งให้ AI ในคำตอบใหม่" : "เนื้อหาที่เผยแพร่จะถูกค้นมาใช้อ้างอิงตามคำถามและหมวด"}` : undefined}
        confirmLabel={confirmToggle?.enabled ? "ยืนยันปิดการอ้างอิง" : "ยืนยันเปิดการอ้างอิง"}
        onCancel={() => setConfirmToggle(null)} onConfirm={() => { if (confirmToggle) void toggleEnabled(confirmToggle); }}/>
    </AdminPage>
  );
}
