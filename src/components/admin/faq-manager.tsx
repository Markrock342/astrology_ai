"use client";

import { useCallback, useEffect, useState } from "react";
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
  Select,
  TextArea,
  Toggle,
  adminFetch,
} from "./ui";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  enabled: boolean;
  sortOrder: number;
  draftQuestion: string | null;
  draftAnswer: string | null;
  hasDraft: boolean;
};

const CATEGORIES = [
  { id: "general", label: "ทั่วไป" },
  { id: "credits", label: "เครดิต" },
  { id: "pro", label: "Pro" },
  { id: "payment", label: "ชำระเงิน" },
  { id: "accuracy", label: "ความแม่นยำ" },
];

const EMPTY = { question: "", answer: "", category: "general", enabled: true, sortOrder: 0 };

export function FaqManager({ initialItems }: { initialItems?: FaqItem[] | null }) {
  const [items, setItems] = useState<FaqItem[]>(initialItems ?? []);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialItems);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await adminFetch<FaqItem[]>("/api/admin/faq"));
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

  function startEdit(item: FaqItem) {
    setEditingId(item.id);
    setForm({
      question: item.draftQuestion ?? item.question,
      answer: item.draftAnswer ?? item.answer,
      category: item.category,
      enabled: item.enabled,
      sortOrder: item.sortOrder,
    });
    setShowForm(true);
    void loadRevisions(item.id);
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
        body: JSON.stringify({ question: form.question, answer: form.answer }),
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
      const fresh = await adminFetch<FaqItem[]>("/api/admin/faq");
      setItems(fresh);
      const item = fresh.find((x) => x.id === editingId);
      if (item) {
        setForm({
          question: item.draftQuestion ?? item.question,
          answer: item.draftAnswer ?? item.answer,
          category: item.category,
          enabled: item.enabled,
          sortOrder: item.sortOrder,
        });
      }
      await loadRevisions(editingId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("ลบคำถามนี้?")) return;
    await adminFetch(`/api/admin/faq/${id}`, { method: "DELETE" });
    if (editingId === id) setShowForm(false);
    await load();
  }

  const editingItem = editingId ? items.find((i) => i.id === editingId) : null;

  return (
    <AdminPage>
      <PageHeader
        title="คำถามที่พบบ่อย"
        description="FAQ / Help Center — ผู้ใช้ดูได้ที่ /help"
        action={<Button onClick={startNew}>+ เพิ่มคำถาม</Button>}
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {showForm && (
        <Card className="mb-4">
          {editingId && (
            <ContentEditorToolbar
              hasDraft={editingItem?.hasDraft ?? false}
              previewHref={`/help?preview=1`}
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
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{item.question}</span>
              {item.hasDraft && <Badge tone="gold">แบบร่าง</Badge>}
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
