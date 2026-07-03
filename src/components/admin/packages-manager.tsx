"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminFetch,
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
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

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr: string[]): string {
  return arr.join("\n");
}

export function PackagesManager() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: 0,
    billingLabel: "",
    creditQuota: 0,
    enabled: true,
    description: "",
    featuresText: "",
    upgradeStepsText: "",
  });
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

  function startEdit(pkg: Package) {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      price: pkg.price,
      billingLabel: pkg.billingLabel ?? "",
      creditQuota: pkg.creditQuota,
      enabled: pkg.enabled,
      description: pkg.description ?? "",
      featuresText: arrayToLines(pkg.features),
      upgradeStepsText: arrayToLines(pkg.upgradeSteps),
    });
  }

  async function save() {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/packages/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          billingLabel: form.billingLabel || undefined,
          creditQuota: Number(form.creditQuota),
          enabled: form.enabled,
          description: form.description || undefined,
          features: linesToArray(form.featuresText),
          upgradeSteps: linesToArray(form.upgradeStepsText),
        }),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="แพ็กเกจ Free / Pro"
        description="แก้ราคา รายละเอียด และ bullet ที่แสดงในหน้าบัญชี & แพ็กเกจของผู้ใช้ — บันทึกแล้วมีผลทันที"
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {editingId && (
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
              <Button onClick={save} disabled={busy || !form.name}>
                {busy ? "กำลังบันทึก…" : "บันทึก"}
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
              {!pkg.enabled && <Badge tone="red">ปิดอยู่</Badge>}
              <div className="ml-auto">
                <Button variant="ghost" onClick={() => startEdit(pkg)}>
                  แก้ไข
                </Button>
              </div>
            </div>
            <ul className="mt-2 list-inside list-disc text-xs text-[var(--muted)]">
              {(pkg.features.length > 0
                ? pkg.features
                : [`เครดิต ${pkg.creditQuota} ครั้ง`]
              ).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
