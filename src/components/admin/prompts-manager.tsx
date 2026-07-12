"use client";

import { useCallback, useEffect, useState } from "react";
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

type PromptSummary = {
  id: string;
  code: string;
  name: string;
  type: "SYSTEM" | "PERSONA" | "CATEGORY" | "FORMAT";
  version: number;
  enabled: boolean;
  draftUpdatedAt: string | null;
};

type Prompt = PromptSummary & {
  content: string;
  draftContent: string | null;
};

const TYPE_LABEL: Record<Prompt["type"], string> = {
  SYSTEM: "System",
  PERSONA: "Persona",
  CATEGORY: "หมวดหมู่",
  FORMAT: "รูปแบบคำตอบ",
};

const EMPTY_FORM = {
  code: "",
  name: "",
  type: "PERSONA" as Prompt["type"],
  content: "",
  enabled: true,
};

export function PromptsManager() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);

  const loadRevisions = useCallback(async (id: string) => {
    setRevisions(
      await adminFetch<ContentRevision[]>(
        `/api/admin/revisions?entityType=PROMPT_TEMPLATE&entityId=${encodeURIComponent(id)}`,
      ),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPrompts(await adminFetch<PromptSummary[]>("/api/admin/prompts"));
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

  async function startEdit(p: PromptSummary) {
    setEditingId(p.id);
    setShowForm(true);
    setBusy(true);
    setError(null);
    try {
      const full = await adminFetch<Prompt>(`/api/admin/prompts/${p.id}`);
      setForm({
        code: full.code,
        name: full.name,
        type: full.type,
        content: full.draftContent ?? full.content,
        enabled: full.enabled,
      });
      void loadRevisions(p.id);
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
    setError(null);
    try {
      await adminFetch(`/api/admin/prompts/${editingId}/draft`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          content: form.content,
          enabled: form.enabled,
        }),
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
      if (editingId) {
        await adminFetch(`/api/admin/prompts/${editingId}/publish`, {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            content: form.content,
            enabled: form.enabled,
          }),
        });
      } else {
        await adminFetch("/api/admin/prompts", {
          method: "POST",
          body: JSON.stringify(form),
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
      const full = await adminFetch<Prompt>(`/api/admin/prompts/${editingId}`);
      setForm({
        code: full.code,
        name: full.name,
        type: full.type,
        content: full.draftContent ?? full.content,
        enabled: full.enabled,
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
    if (!window.confirm("ลบ prompt นี้?")) return;
    try {
      await adminFetch(`/api/admin/prompts/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  async function toggleEnabled(p: PromptSummary) {
    try {
      await adminFetch(`/api/admin/prompts/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !p.enabled }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ");
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="Prompt / Persona"
        description="กำหนดนิสัย โทนเสียง และกฎการตอบของ AI — แก้เนื้อหาแล้ว version จะ +1 อัตโนมัติ (การตั้งค่า prompt ไม่ใช่การเทรนโมเดล)"
        action={
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            + เพิ่ม Prompt
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {showForm && (
        <Card>
          {editingId && (
            <ContentEditorToolbar
              hasDraft={Boolean(prompts.find((p) => p.id === editingId)?.draftUpdatedAt)}
              busy={busy}
              onSaveDraft={() => void saveDraft()}
              onPublish={() => void publish()}
              revisions={revisions}
              onRestore={(id, mode) => void restoreRevision(id, mode)}
            />
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Code (ตั้งครั้งเดียว แก้ไม่ได้)" hint="เช่น persona-main">
              <TextInput
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={!!editingId}
              />
            </Field>
            <Field label="ชื่อ">
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น แม่หมอหลัก"
              />
            </Field>
            <Field label="ประเภท">
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Prompt["type"] })}
              >
                {Object.entries(TYPE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field
              label="เนื้อหา prompt"
              hint="บอกนิสัย โทนเสียง กฎการตอบ เช่น 'คุณคือแม่หมอ... ห้ามทำนายเรื่องความตาย...'"
            >
              <TextArea
                rows={10}
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
                disabled={busy || !form.name || !form.content || (!editingId && !form.code)}
              >
                {busy ? "กำลังบันทึก…" : editingId ? "เผยแพร่" : "สร้าง prompt"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading && !showForm ? (
        <div className="mt-4 flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
      <div className="mt-4 flex flex-col gap-3">
        {prompts.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{p.name}</span>
              <Badge tone="gold">{TYPE_LABEL[p.type]}</Badge>
              <Badge>v{p.version}</Badge>
              <Badge>{p.code}</Badge>
              {!p.enabled && <Badge tone="red">ปิดอยู่</Badge>}
              {p.draftUpdatedAt ? <Badge tone="gold">มีแบบร่าง</Badge> : null}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => toggleEnabled(p)}>
                  {p.enabled ? "ปิด" : "เปิด"}
                </Button>
                <Button variant="ghost" onClick={() => startEdit(p)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => remove(p.id)}>
                  ลบ
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {prompts.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">ยังไม่มี prompt</p>
        )}
      </div>
      )}
    </AdminPage>
  );
}
