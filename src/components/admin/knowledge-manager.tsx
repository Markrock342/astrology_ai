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
    try {
      await adminFetch(`/api/admin/knowledge/${d.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !d.enabled }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ");
    }
  }

  const totalChars = docs
    .filter((d) => d.enabled)
    .reduce((s, d) => s + d.contentChars, 0);

  return (
    <AdminPage>
      <PageHeader
        title="คลังความรู้ (Knowledge)"
        description="วางเนื้อหา FAQ/ตำรา ให้ AI ใช้อ้างอิงตอบ — เนื้อหาที่เปิดใช้จะถูกส่งเข้า prompt ทุกครั้ง ยิ่งยาวยิ่งใช้ token มาก"
        action={
          <Button
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
        เนื้อหาที่เปิดใช้รวม {totalChars.toLocaleString()} ตัวอักษร
        {totalChars > 30000 && (
          <span className="text-[var(--danger)]">
            {" "}
            — เริ่มเยอะแล้ว ควรพิจารณาปิดบางส่วนหรืออัปเกรดเป็น RAG
          </span>
        )}
      </p>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

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
        {docs.map((d) => (
          <Card key={d.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{d.title}</span>
              <Badge tone="gold">{d.category?.nameTh ?? "ทุกหมวด"}</Badge>
              {!d.enabled && <Badge tone="red">ปิดอยู่</Badge>}
              {d.draftUpdatedAt ? <Badge tone="gold">มีแบบร่าง</Badge> : null}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => toggleEnabled(d)}>
                  {d.enabled ? "ปิด" : "เปิด"}
                </Button>
                <Button variant="ghost" onClick={() => startEdit(d)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => remove(d.id)}>
                  ลบ
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {docs.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">
            ยังไม่มีเอกสารความรู้ — กด &quot;+ เพิ่มเอกสาร&quot; แล้ววางเนื้อหา FAQ/ตำราได้เลย
          </p>
        )}
      </div>
      )}
    </AdminPage>
  );
}
