"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContentEditorToolbar,
  type ContentRevision,
} from "./content-editor-toolbar";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  PageHeader,
  SearchInput,
  Select,
  TextArea,
  Toggle,
  adminFetch,
} from "./ui";

type FaqSummary = {
  id: string;
  question: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  draftUpdatedAt: string | null;
  hasDraft: boolean;
};

type FaqItem = FaqSummary & {
  answer: string;
  draftQuestion: string | null;
  draftAnswer: string | null;
};

const CATEGORIES = [
  { id: "general", label: "ทั่วไป" },
  { id: "credits", label: "เครดิต" },
  { id: "pro", label: "Pro" },
  { id: "payment", label: "ชำระเงิน" },
  { id: "accuracy", label: "ความแม่นยำ" },
];

const EMPTY = { question: "", answer: "", category: "general", enabled: true, sortOrder: 0 };

export function FaqManager({ initialItems }: { initialItems?: FaqSummary[] | null }) {
  const [items, setItems] = useState<FaqSummary[]>(initialItems ?? []);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialItems);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await adminFetch<FaqSummary[]>("/api/admin/faq"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevisions = useCallback(async (id: string) => {
    const rows = await adminFetch<ContentRevision[]>(
      `/api/admin/revisions?entityType=FAQ_ITEM&entityId=${encodeURIComponent(id)}`,
    );
    setRevisions(rows);
  }, []);

  useEffect(() => {
    if (initialItems) return;
    void load().catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
  }, [initialItems, load]);

  async function startEdit(item: FaqSummary) {
    setEditingId(item.id);
    setShowForm(true);
    setBusy(true);
    setError(null);
    try {
      const full = await adminFetch<FaqItem>(`/api/admin/faq/${item.id}`);
      setForm({
        question: full.draftQuestion ?? full.question,
        answer: full.draftAnswer ?? full.answer,
        category: full.category,
        enabled: full.enabled,
        sortOrder: full.sortOrder,
      });
      void loadRevisions(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดเนื้อหาไม่สำเร็จ");
      setShowForm(false);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY);
    setRevisions([]);
    setShowForm(true);
  }

  async function saveDraft() {
    if (!editingId) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/faq/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(form),
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
    try {
      if (editingId) {
        await adminFetch(`/api/admin/faq/${editingId}`, {
          method: "POST",
          body: JSON.stringify(form),
        });
      } else {
        await adminFetch("/api/admin/faq", { method: "POST", body: JSON.stringify(form) });
        setShowForm(false);
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
      const full = await adminFetch<FaqItem>(`/api/admin/faq/${editingId}`);
      setForm({
        question: full.draftQuestion ?? full.question,
        answer: full.draftAnswer ?? full.answer,
        category: full.category,
        enabled: full.enabled,
        sortOrder: full.sortOrder,
      });
      await loadRevisions(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("ลบคำถามนี้?")) return;
    try {
      await adminFetch(`/api/admin/faq/${id}`, { method: "DELETE" });
      if (editingId === id) setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  const editingItem = editingId ? items.find((i) => i.id === editingId) : null;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    // The list payload no longer carries the answer body (fetched only when an
    // item is opened), so search matches on question and category.
    return items.filter(
      (i) =>
        i.question.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <AdminPage>
      <PageHeader
        title="คำถามที่พบบ่อย"
        description="FAQ / Help Center — ผู้ใช้ดูได้ที่ /help"
        action={<Button onClick={startNew}>+ เพิ่มคำถาม</Button>}
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="ค้นหาคำถาม…" />
      </div>
      {showForm && (
        <Card className="mb-4">
          {editingId && (
            <ContentEditorToolbar
              hasDraft={editingItem?.hasDraft ?? false}
              previewHref="/help"
              busy={busy}
              onSaveDraft={() => void saveDraft()}
              onPublish={() => void publish()}
              revisions={revisions}
              onRestore={(id, mode) => void restoreRevision(id, mode)}
            />
          )}
          <div className="grid gap-3">
            <Field label="หมวด">
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="คำถาม">
              <TextArea
                rows={2}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
              />
            </Field>
            <Field label="คำตอบ">
              <TextArea
                rows={5}
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
              />
            </Field>
            <Toggle
              checked={form.enabled}
              onChange={(enabled) => setForm({ ...form, enabled })}
              label="เผยแพร่บนหน้า Help"
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              ปิด
            </Button>
            {!editingId && (
              <Button onClick={() => void publish()} disabled={busy}>
                สร้างและเผยแพร่
              </Button>
            )}
          </div>
        </Card>
      )}

      {loading && !showForm ? (
        <div className="flex flex-col gap-2">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        {filtered.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{item.question}</span>
              {item.draftUpdatedAt ? <Badge tone="gold">แบบร่าง</Badge> : null}
              {!item.enabled && <Badge tone="muted">ปิด</Badge>}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(item)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => void remove(item.id)}>
                  ลบ
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      )}
    </AdminPage>
  );
}
