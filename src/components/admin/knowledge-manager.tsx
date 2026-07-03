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

type Category = { id: string; nameTh: string };
type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  categoryId: string | null;
  enabled: boolean;
  sortOrder: number;
  category: { id: string; nameTh: string } | null;
};

const EMPTY_FORM = {
  title: "",
  content: "",
  categoryId: "",
  enabled: true,
  sortOrder: 0,
};

export function KnowledgeManager() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ds, cats] = await Promise.all([
        adminFetch<KnowledgeDoc[]>("/api/admin/knowledge"),
        adminFetch<Category[]>("/api/admin/categories"),
      ]);
      setDocs(ds);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // Async data fetch — setState runs after await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function startEdit(d: KnowledgeDoc) {
    setEditingId(d.id);
    setForm({
      title: d.title,
      content: d.content,
      categoryId: d.categoryId ?? "",
      enabled: d.enabled,
      sortOrder: d.sortOrder,
    });
    setShowForm(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        sortOrder: Number(form.sortOrder),
      };
      if (editingId) {
        await adminFetch(`/api/admin/knowledge/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/api/admin/knowledge", {
          method: "POST",
          body: JSON.stringify(payload),
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
    if (!window.confirm("ลบเอกสารนี้?")) return;
    try {
      await adminFetch(`/api/admin/knowledge/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  async function toggleEnabled(d: KnowledgeDoc) {
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

  const totalChars = docs.filter((d) => d.enabled).reduce((s, d) => s + d.content.length, 0);

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
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="ชื่อเอกสาร">
              <TextInput
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
              <Button onClick={save} disabled={busy || !form.title || !form.content}>
                {busy ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "เพิ่มเอกสาร"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {docs.map((d) => (
          <Card key={d.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{d.title}</span>
              <Badge tone="gold">{d.category?.nameTh ?? "ทุกหมวด"}</Badge>
              <Badge>{d.content.length.toLocaleString()} ตัวอักษร</Badge>
              {!d.enabled && <Badge tone="red">ปิดอยู่</Badge>}
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
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
              {d.content.length > 240 ? `${d.content.slice(0, 240)}…` : d.content}
            </p>
          </Card>
        ))}
        {docs.length === 0 && !showForm && (
          <p className="text-sm text-[var(--muted-2)]">
            ยังไม่มีเอกสารความรู้ — กด &quot;+ เพิ่มเอกสาร&quot; แล้ววางเนื้อหา FAQ/ตำราได้เลย
          </p>
        )}
      </div>
    </AdminPage>
  );
}
