"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
  adminFetch,
} from "./ui";

type Category = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string | null;
  description: string | null;
  accessLevel: "FREE" | "PRO";
  creditCost: number;
  enabled: boolean;
  sortOrder: number;
  suggestedQuestions: string[] | null;
};

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    nameTh: "",
    nameEn: "",
    description: "",
    accessLevel: "FREE" as "FREE" | "PRO",
    creditCost: 1,
    enabled: true,
    sortOrder: 0,
    suggestedText: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await adminFetch<Category[]>("/api/admin/categories");
      setCategories(
        rows.map((c) => ({
          ...c,
          suggestedQuestions: Array.isArray(c.suggestedQuestions)
            ? (c.suggestedQuestions as string[])
            : null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setShowCreate(false);
    setForm({
      slug: cat.slug,
      nameTh: cat.nameTh,
      nameEn: cat.nameEn ?? "",
      description: cat.description ?? "",
      accessLevel: cat.accessLevel,
      creditCost: cat.creditCost,
      enabled: cat.enabled,
      sortOrder: cat.sortOrder,
      suggestedText: (cat.suggestedQuestions ?? []).join("\n"),
    });
  }

  function startCreate() {
    setEditingId(null);
    setShowCreate(true);
    setForm({
      slug: "",
      nameTh: "",
      nameEn: "",
      description: "",
      accessLevel: "FREE",
      creditCost: 1,
      enabled: true,
      sortOrder: categories.length,
      suggestedText: "",
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    // Slug is immutable after creation, so it's only sent on POST (create).
    const patch = {
      nameTh: form.nameTh,
      nameEn: form.nameEn || undefined,
      description: form.description || undefined,
      accessLevel: form.accessLevel,
      creditCost: Number(form.creditCost),
      enabled: form.enabled,
      sortOrder: Number(form.sortOrder),
      suggestedQuestions: linesToArray(form.suggestedText),
    };
    try {
      if (editingId) {
        await adminFetch(`/api/admin/categories/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      } else {
        await adminFetch("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify({ slug: form.slug, ...patch }),
        });
      }
      setEditingId(null);
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const formOpen = Boolean(editingId || showCreate);

  return (
    <AdminPage>
      <PageHeader
        title="หมวดหมู่ดูดวง"
        description="จัดการหัวข้อใน sidebar · Free/Pro · ค่าเครดิต · คำถามแนะนำ"
        action={<Button onClick={startCreate}>+ หมวดใหม่</Button>}
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {formOpen && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Slug (URL)">
              <TextInput
                value={form.slug}
                disabled={Boolean(editingId)}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="career"
              />
            </Field>
            <Field label="ชื่อ (ไทย)">
              <TextInput
                value={form.nameTh}
                onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
              />
            </Field>
            <Field label="ชื่อ (อังกฤษ)">
              <TextInput
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              />
            </Field>
            <Field label="ระดับ">
              <Select
                value={form.accessLevel}
                onChange={(e) =>
                  setForm({ ...form, accessLevel: e.target.value as "FREE" | "PRO" })
                }
              >
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
              </Select>
            </Field>
            <Field label="เครดิต/คำถาม">
              <TextInput
                type="number"
                min={0}
                value={form.creditCost}
                onChange={(e) =>
                  setForm({ ...form, creditCost: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="ลำดับ">
              <TextInput
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="คำอธิบาย" >
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="คำถามแนะนำ" hint="หนึ่งบรรทัดต่อหนึ่งคำถาม">
            <TextArea
              rows={4}
              value={form.suggestedText}
              onChange={(e) => setForm({ ...form, suggestedText: e.target.value })}
            />
          </Field>
          <div className="mt-3 flex items-center gap-3">
            <Toggle
              checked={form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
              label="เปิดใช้งาน"
            />
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setShowCreate(false);
                }}
              >
                ยกเลิก
              </Button>
              <Button onClick={save} disabled={busy || !form.nameTh || !form.slug}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[var(--foreground)]">{cat.nameTh}</span>
              <Badge tone="muted">{cat.slug}</Badge>
              <Badge tone={cat.accessLevel === "PRO" ? "gold" : "green"}>
                {cat.accessLevel}
              </Badge>
              <Badge>{cat.creditCost} เครดิต</Badge>
              {!cat.enabled && <Badge tone="red">ปิด</Badge>}
              <div className="ml-auto">
                <Button variant="ghost" onClick={() => startEdit(cat)}>
                  แก้ไข
                </Button>
              </div>
            </div>
            {cat.description && (
              <p className="mt-2 text-xs text-[var(--muted)]">{cat.description}</p>
            )}
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
