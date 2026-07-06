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
} from "../admin/ui";

type Package = {
  id: string;
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel: string | null;
  creditQuota: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  enabled: boolean;
  description: string | null;
  features: string[];
  upgradeSteps: string[];
};

type FormState = {
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel: string;
  creditQuota: number;
  dailyLimit: string;
  monthlyLimit: string;
  enabled: boolean;
  description: string;
  featuresText: string;
  upgradeStepsText: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  type: "FREE",
  price: 0,
  billingLabel: "",
  creditQuota: 0,
  dailyLimit: "",
  monthlyLimit: "",
  enabled: true,
  description: "",
  featuresText: "",
  upgradeStepsText: "",
};

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function limitToNumber(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

export function PackagesManager() {
  const [packages, setPackages] = useState<Package[]>([]);
  // editingId: null = closed, "new" = creating, otherwise package id.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPackages(await adminFetch<Package[]>("/api/admin/packages"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function startCreate() {
    setEditingId("new");
    setForm(EMPTY_FORM);
  }

  function startEdit(pkg: Package) {
    setEditingId(pkg.id);
    setForm({
      code: pkg.code,
      name: pkg.name,
      type: pkg.type,
      price: pkg.price,
      billingLabel: pkg.billingLabel ?? "",
      creditQuota: pkg.creditQuota,
      dailyLimit: pkg.dailyLimit == null ? "" : String(pkg.dailyLimit),
      monthlyLimit: pkg.monthlyLimit == null ? "" : String(pkg.monthlyLimit),
      enabled: pkg.enabled,
      description: pkg.description ?? "",
      featuresText: (pkg.features ?? []).join("\n"),
      upgradeStepsText: (pkg.upgradeSteps ?? []).join("\n"),
    });
  }

  async function save() {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    const isNew = editingId === "new";
    const body = {
      ...(isNew ? { code: form.code, type: form.type } : {}),
      name: form.name,
      price: Number(form.price),
      billingLabel: form.billingLabel || undefined,
      creditQuota: Number(form.creditQuota),
      dailyLimit: limitToNumber(form.dailyLimit),
      monthlyLimit: limitToNumber(form.monthlyLimit),
      enabled: form.enabled,
      description: form.description || undefined,
      features: linesToArray(form.featuresText),
      upgradeSteps: linesToArray(form.upgradeStepsText),
    };
    try {
      await adminFetch(isNew ? "/api/admin/packages" : `/api/admin/packages/${editingId}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(pkg: Package) {
    if (!window.confirm(`ลบแพ็กเกจ "${pkg.name}" ?`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/packages/${pkg.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <PageHeader
        title="แพ็กเกจ Free / Pro"
        description="สร้าง แก้ไข และกำหนดโควตา — บันทึกแล้วมีผลทันที"
        action={<Button onClick={startCreate}>+ สร้างแพ็กเกจ</Button>}
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {editingId && (
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {editingId === "new" && (
              <>
                <Field label="รหัสแพ็กเกจ (code)" hint="เช่น PRO_YEARLY — ห้ามซ้ำ">
                  <TextInput
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </Field>
                <Field label="ประเภท">
                  <Select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as "FREE" | "PRO" })
                    }
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                  </Select>
                </Field>
              </>
            )}
            <Field label="ชื่อแพ็กเกจ">
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="ราคา (บาท)">
              <TextInput
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="ป้ายราคา" hint="เช่น ต่อเดือน, ต่อแพ็กเกจ">
              <TextInput
                value={form.billingLabel}
                onChange={(e) => setForm({ ...form, billingLabel: e.target.value })}
              />
            </Field>
            <Field label="โควตาเครดิต">
              <TextInput
                type="number"
                min={0}
                value={form.creditQuota}
                onChange={(e) =>
                  setForm({ ...form, creditQuota: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="จำกัดต่อวัน (ครั้ง)" hint="เว้นว่าง = ไม่จำกัด">
              <TextInput
                type="number"
                min={0}
                value={form.dailyLimit}
                onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
              />
            </Field>
            <Field label="จำกัดต่อเดือน (ครั้ง)" hint="เว้นว่าง = ไม่จำกัด">
              <TextInput
                type="number"
                min={0}
                value={form.monthlyLimit}
                onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })}
              />
            </Field>
            <Field label="คำอธิบายสั้น">
              <TextInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="รายการคุณสมบัติ (แสดงในการ์ด)"
              hint="หนึ่งบรรทัดต่อหนึ่ง bullet"
            >
              <TextArea
                rows={5}
                value={form.featuresText}
                onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
              />
            </Field>
            <Field
              label="ขั้นตอนอัปเกรด Pro (แพ็กเกจ Pro เท่านั้น)"
              hint="หนึ่งบรรทัดต่อหนึ่งขั้นตอน — แสดงในหน้าบัญชีผู้ใช้"
            >
              <TextArea
                rows={5}
                value={form.upgradeStepsText}
                onChange={(e) =>
                  setForm({ ...form, upgradeStepsText: e.target.value })
                }
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
              <Button variant="ghost" onClick={() => setEditingId(null)}>
                ยกเลิก
              </Button>
              <Button
                onClick={save}
                disabled={busy || !form.name || (editingId === "new" && !form.code)}
              >
                {busy ? "กำลังบันทึก…" : editingId === "new" ? "สร้าง" : "บันทึก"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {packages.map((pkg) => (
          <Card key={pkg.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">
                {pkg.name}
              </span>
              <Badge tone="gold">{pkg.type}</Badge>
              <Badge>฿{pkg.price}</Badge>
              <Badge>{pkg.creditQuota} เครดิต</Badge>
              {pkg.dailyLimit != null && <Badge>{pkg.dailyLimit}/วัน</Badge>}
              {pkg.monthlyLimit != null && <Badge>{pkg.monthlyLimit}/เดือน</Badge>}
              {!pkg.enabled && <Badge tone="red">ปิดอยู่</Badge>}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => startEdit(pkg)}>
                  แก้ไข
                </Button>
                <Button variant="danger" onClick={() => remove(pkg)} disabled={busy}>
                  ลบ
                </Button>
              </div>
            </div>
            <ul className="mt-2 list-inside list-disc text-xs text-[var(--muted)]">
              {(pkg.features && pkg.features.length > 0
                ? pkg.features
                : [`เครดิต ${pkg.creditQuota} ครั้ง`]
              ).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
