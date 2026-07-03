"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminFetch,
  AdminPage,
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from "./ui";

type Prompt = {
  id: string;
  code: string;
  name: string;
  type: "SYSTEM" | "PERSONA" | "CATEGORY" | "FORMAT";
  content: string;
  version: number;
  enabled: boolean;
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
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPrompts(await adminFetch<Prompt[]>("/api/admin/prompts"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // Async data fetch — setState runs after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function startEdit(p: Prompt) {
    setEditingId(p.id);
    setForm({ code: p.code, name: p.name, type: p.type, content: p.content, enabled: p.enabled });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (editingId) {
        // code is immutable after creation
        const payload = {
          name: form.name,
          type: form.type,
          content: form.content,
          enabled: form.enabled,
        };
        await adminFetch(`/api/admin/prompts/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/api/admin/prompts", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
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

  async function toggleEnabled(p: Prompt) {
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
                onClick={save}
                disabled={busy || !form.name || !form.content || (!editingId && !form.code)}
              >
                {busy ? "กำลังบันทึก…" : editingId ? "บันทึก (version +1)" : "สร้าง prompt"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {prompts.map((p) => (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{p.name}</span>
              <Badge tone="gold">{TYPE_LABEL[p.type]}</Badge>
              <Badge>v{p.version}</Badge>
              <Badge>{p.code}</Badge>
              {!p.enabled && <Badge tone="red">ปิดอยู่</Badge>}
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
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
              {p.content.length > 300 ? `${p.content.slice(0, 300)}…` : p.content}
            </p>
          </Card>
        ))}
        {prompts.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">ยังไม่มี prompt</p>
        )}
      </div>
    </AdminPage>
  );
}
