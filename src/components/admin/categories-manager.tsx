"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  ImageUploadField,
  InfoBox,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";
import {
  CategoryIcon,
  isCustomCategoryIcon,
} from "@/components/app/category-icon";

type Category = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string | null;
  description: string | null;
  icon: string | null;
  accessLevel: "FREE" | "PRO";
  creditCost: number;
  enabled: boolean;
  sortOrder: number;
  suggestedQuestions: string[] | null;
  promptTemplateId: string | null;
};

type PromptOption = { id: string; code: string; name: string };

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const ICON_HINT =
  "แนะนำ PNG พื้นหลังโปร่งใส · 64×64 หรือ 128×128 px (สูงสุด 256×256) · ไฟล์ ≤ 4 MB (PNG/JPG/WebP) · สีทองหรือขาวจะเข้ากับธีม sidebar";

export function CategoriesManager({
  initialCategories,
}: {
  initialCategories?: Category[] | null;
}) {
  const [categories, setCategories] = useState<Category[]>(() =>
    (initialCategories ?? []).map((c) => ({
      ...c,
      icon: c.icon ?? null,
      suggestedQuestions: Array.isArray(c.suggestedQuestions)
        ? (c.suggestedQuestions as string[])
        : null,
    })),
  );
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    nameTh: "",
    nameEn: "",
    description: "",
    icon: "",
    accessLevel: "FREE" as "FREE" | "PRO",
    creditCost: 1,
    enabled: true,
    sortOrder: 0,
    suggestedText: "",
    promptTemplateId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialCategories);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, p] = await Promise.all([
        adminFetch<Category[]>("/api/admin/categories"),
        adminFetch<PromptOption[]>("/api/admin/prompts").catch(() => [] as PromptOption[]),
      ]);
      setCategories(
        rows.map((c) => ({
          ...c,
          icon: c.icon ?? null,
          suggestedQuestions: Array.isArray(c.suggestedQuestions)
            ? (c.suggestedQuestions as string[])
            : null,
        })),
      );
      setPrompts(p.map((x) => ({ id: x.id, code: x.code, name: x.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCategories) {
      void adminFetch<PromptOption[]>("/api/admin/prompts")
        .catch(() => [] as PromptOption[])
        .then((p) => {
          setPrompts(p.map((x) => ({ id: x.id, code: x.code, name: x.name })));
        });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [initialCategories, load]);

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setShowCreate(false);
    setForm({
      slug: cat.slug,
      nameTh: cat.nameTh,
      nameEn: cat.nameEn ?? "",
      description: cat.description ?? "",
      icon: isCustomCategoryIcon(cat.icon) ? cat.icon : "",
      accessLevel: cat.accessLevel,
      creditCost: cat.creditCost,
      enabled: cat.enabled,
      sortOrder: cat.sortOrder,
      suggestedText: (cat.suggestedQuestions ?? []).join("\n"),
      promptTemplateId: cat.promptTemplateId ?? "",
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
      icon: "",
      accessLevel: "FREE",
      creditCost: 1,
      enabled: true,
      sortOrder: categories.length,
      suggestedText: "",
      promptTemplateId: "",
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const iconValue = form.icon.trim();
    const patch = {
      nameTh: form.nameTh,
      nameEn: form.nameEn || undefined,
      description: form.description || undefined,
      icon: iconValue ? iconValue : editingId ? null : undefined,
      accessLevel: form.accessLevel,
      creditCost: Number(form.creditCost),
      enabled: form.enabled,
      sortOrder: Number(form.sortOrder),
      suggestedQuestions: linesToArray(form.suggestedText),
      promptTemplateId: form.promptTemplateId || null,
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

  async function remove(id: string, nameTh: string) {
    if (
      !window.confirm(
        `ลบหมวด «${nameTh}»?\n\nถ้าหมวดถูกใช้งานอยู่ ระบบจะปิดใช้งานแทนการลบถาวร`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await adminFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (editingId === id) {
        setEditingId(null);
        setShowCreate(false);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }

  const formOpen = Boolean(editingId || showCreate);

  return (
    <AdminPage>
      <PageHeader
        title="หมวดดูดวง"
        description="หัวข้อที่ผู้ใช้เลือกใน sidebar — กำหนดสิทธิ์ Free/Pro และอัปโหลดไอคอนได้เอง"
        action={<Button onClick={startCreate}>+ หมวดใหม่</Button>}
      />

      <InfoBox>
        <strong className="text-[var(--foreground)]">Slug</strong> = ชื่อใน URL (ภาษาอังกฤษ, ไม่มีช่องว่าง) ·{" "}
        usage ของแต่ละคำตอบคำนวณจากต้นทุนโมเดลจริง ·{" "}
        <strong className="text-[var(--foreground)]">ลำดับ</strong> = เรียงใน sidebar (เลขน้อยอยู่บน) ·{" "}
        <strong className="text-[var(--foreground)]">ไอคอน</strong> = PNG โปร่งใส{" "}
        <strong className="text-[var(--foreground)]">64×64 หรือ 128×128 px</strong> (สูงสุด 256×256)
      </InfoBox>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {loading && !formOpen && (
        <div className="flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {formOpen && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Slug (ชื่อใน URL)" hint="ภาษาอังกฤษ เช่น career — สร้างแล้วแก้ไม่ได้">
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
            <Field label="ใครใช้ได้">
              <Select
                value={form.accessLevel}
                onChange={(e) =>
                  setForm({ ...form, accessLevel: e.target.value as "FREE" | "PRO" })
                }
              >
                <option value="FREE">ทุกคน (ฟรี)</option>
                <option value="PRO">เฉพาะ Pro</option>
              </Select>
            </Field>
            <Field label="ลำดับใน sidebar" hint="เลขน้อย = แสดงบน">
              <TextInput
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <ImageUploadField
              label="ไอคอนหมวด (sidebar)"
              value={form.icon}
              onChange={(url) => setForm({ ...form, icon: url })}
              hint={ICON_HINT}
            />
            <div className="flex flex-col items-start gap-2 pb-1">
              <span className="text-[11px] text-[var(--muted)]">ตัวอย่างในเมนู</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]">
                <CategoryIcon
                  slug={form.slug || "self"}
                  icon={form.icon || null}
                  size={20}
                />
              </span>
              {form.icon ? (
                <Button
                  variant="ghost"
                  onClick={() => setForm({ ...form, icon: "" })}
                >
                  ล้างไอคอน (ใช้ค่าเริ่มต้น)
                </Button>
              ) : null}
            </div>
          </div>

          <Field label="คำอธิบาย">
            <TextInput
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="คำถามตัวอย่าง" hint="แสดงเป็นปุ่มแนะนำ — หนึ่งบรรทัดต่อหนึ่งคำถาม">
            <TextArea
              rows={4}
              value={form.suggestedText}
              onChange={(e) => setForm({ ...form, suggestedText: e.target.value })}
            />
          </Field>
          {prompts.length > 0 && (
            <Field
              label="บุคลิก AI ของหมวดนี้"
              hint="เลือกสไตล์การตอบ — ว่าง = ใช้ค่าเริ่มต้นระบบ · ผูกโมเดลที่หน้า โมเดล AI"
            >
              <Select
                value={form.promptTemplateId}
                onChange={(e) =>
                  setForm({ ...form, promptTemplateId: e.target.value })
                }
              >
                <option value="">— ค่าเริ่มต้นระบบ —</option>
                {prompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </Select>
            </Field>
          )}
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
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]">
                <CategoryIcon slug={cat.slug} icon={cat.icon} size={18} />
              </span>
              <span className="font-medium text-[var(--foreground)]">{cat.nameTh}</span>
              <Badge tone="muted">{cat.slug}</Badge>
              <Badge tone={cat.accessLevel === "PRO" ? "gold" : "green"}>
                {cat.accessLevel === "PRO" ? "Pro" : "ฟรี"}
              </Badge>
              <Badge>คิดตามต้นทุนจริง</Badge>
              {isCustomCategoryIcon(cat.icon) ? (
                <Badge tone="gold">ไอคอนอัปโหลด</Badge>
              ) : null}
              {!cat.enabled && <Badge tone="red">ปิด</Badge>}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(cat)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => void remove(cat.id, cat.nameTh)}>
                  ลบ
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
