"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CmsContact,
  CmsDocument,
  CmsKey,
  CmsMaintenance,
  CmsPaymentInfo,
  CmsSection,
  CmsText,
} from "@/lib/cms-keys";
import { CMS_KEYS, CMS_LABELS } from "@/lib/cms-keys";
import {
  AdminPage,
  Button,
  Card,
  Field,
  PageHeader,
  TextArea,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";

type SettingRow = {
  key: CmsKey;
  value: unknown;
  updatedAt: string | null;
  isDefault: boolean;
};

function linesToArray(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function arrayToLines(arr: string[]): string {
  return arr.join("\n");
}

export function SettingsManager() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [activeKey, setActiveKey] = useState<CmsKey>(CMS_KEYS.privacyPolicy);
  const [draft, setDraft] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const data = await adminFetch<SettingRow[]>("/api/admin/settings");
    setRows(data);
    const current = data.find((r) => r.key === activeKey);
    if (current) setDraft(structuredClone(current.value));
  }, [activeKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"),
    );
  }, [load]);

  function selectKey(key: CmsKey) {
    setActiveKey(key);
    setSaved(false);
    const row = rows.find((r) => r.key === key);
    setDraft(row ? structuredClone(row.value) : null);
  }

  async function save() {
    if (draft == null) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await adminFetch(`/api/admin/settings/${activeKey}`, {
        method: "PUT",
        body: JSON.stringify({ value: draft }),
      });
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const activeRow = rows.find((r) => r.key === activeKey);

  return (
    <AdminPage>
      <PageHeader
        title="เนื้อหา & นโยบาย (CMS)"
        description="แก้ไขข้อความทางกฎหมาย ข้อความยินยอม คำแนะนำชำระเงิน และข้อมูลติดต่อ — มีผลทันทีบนหน้าเว็บ"
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      {saved && (
        <p className="mb-4 text-sm text-[var(--secondary-active)]">บันทึกแล้ว</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="!p-3">
          <nav className="flex flex-col gap-1">
            {(Object.values(CMS_KEYS) as CmsKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectKey(key)}
                className={`rounded-lg px-3 py-2 text-left text-xs transition ${
                  activeKey === key
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                }`}
              >
                {CMS_LABELS[key]}
                {rows.find((r) => r.key === key)?.isDefault && (
                  <span className="ml-1 text-[10px] text-[var(--muted-2)]">(default)</span>
                )}
              </button>
            ))}
          </nav>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {CMS_LABELS[activeKey]}
            </h2>
            {activeRow?.updatedAt && (
              <span className="text-[10px] text-[var(--muted-2)]">
                แก้ล่าสุด{" "}
                {new Date(activeRow.updatedAt).toLocaleString("th-TH", {
                  timeZone: "Asia/Bangkok",
                })}
              </span>
            )}
          </div>

          {draft != null && (
            <SettingEditor
              settingKey={activeKey}
              value={draft}
              onChange={setDraft}
            />
          )}

          <div className="mt-6 flex justify-end">
            <Button onClick={save} disabled={busy || draft == null}>
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </Card>
      </div>
    </AdminPage>
  );
}

function SettingEditor({
  settingKey,
  value,
  onChange,
}: {
  settingKey: CmsKey;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (
    settingKey === CMS_KEYS.privacyPolicy ||
    settingKey === CMS_KEYS.termsOfService
  ) {
    return (
      <DocumentEditor
        doc={value as CmsDocument}
        onChange={onChange}
      />
    );
  }
  if (
    settingKey === CMS_KEYS.disclaimer ||
    settingKey === CMS_KEYS.consentRegister ||
    settingKey === CMS_KEYS.consentBirthPrivacy ||
    settingKey === CMS_KEYS.consentBirthEditLimit
  ) {
    const v = value as CmsText;
    return (
      <Field label="ข้อความ">
        <TextArea
          rows={3}
          value={v.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </Field>
    );
  }
  if (settingKey === CMS_KEYS.contact) {
    const v = value as CmsContact;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="อีเมลติดต่อ">
          <TextInput
            type="email"
            value={v.email}
            onChange={(e) => onChange({ ...v, email: e.target.value })}
          />
        </Field>
        <Field label="ชื่อผู้ติดต่อ">
          <TextInput
            value={v.label ?? ""}
            onChange={(e) => onChange({ ...v, label: e.target.value })}
          />
        </Field>
      </div>
    );
  }
  if (settingKey === CMS_KEYS.maintenanceMode) {
    const v = value as CmsMaintenance;
    return (
      <div className="flex flex-col gap-3">
        <Toggle
          checked={v.enabled}
          onChange={(enabled) => onChange({ ...v, enabled })}
          label="เปิดโหมดปิดปรับปรุง (ผู้ใช้ทั่วไปจะเห็นข้อความด้านล่าง)"
        />
        <Field label="ข้อความแจ้งเตือน">
          <TextArea
            rows={3}
            value={v.message}
            onChange={(e) => onChange({ ...v, message: e.target.value })}
          />
        </Field>
      </div>
    );
  }
  if (settingKey === CMS_KEYS.paymentInfo) {
    return (
      <PaymentInfoEditor
        info={value as CmsPaymentInfo}
        onChange={onChange}
      />
    );
  }
  return null;
}

function DocumentEditor({
  doc,
  onChange,
}: {
  doc: CmsDocument;
  onChange: (v: CmsDocument) => void;
}) {
  function updateSection(index: number, patch: Partial<CmsSection>) {
    const sections = doc.sections.map((s, i) =>
      i === index ? { ...s, ...patch } : s,
    );
    onChange({ ...doc, sections });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="หัวข้อหน้า">
          <TextInput
            value={doc.title}
            onChange={(e) => onChange({ ...doc, title: e.target.value })}
          />
        </Field>
        <Field label="วันที่ปรับปรุง (แสดงบนหน้า)">
          <TextInput
            value={doc.lastUpdated}
            onChange={(e) => onChange({ ...doc, lastUpdated: e.target.value })}
          />
        </Field>
      </div>
      <Field label="บทนำ">
        <TextArea
          rows={3}
          value={doc.intro}
          onChange={(e) => onChange({ ...doc, intro: e.target.value })}
        />
      </Field>
      {doc.sections.map((section, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
        >
          <Field label={`หัวข้อ ${i + 1}`}>
            <TextInput
              value={section.heading}
              onChange={(e) => updateSection(i, { heading: e.target.value })}
            />
          </Field>
          <Field label="เนื้อหา (หนึ่งบรรทัดต่อหนึ่ง bullet)">
            <TextArea
              rows={4}
              value={arrayToLines(section.body)}
              onChange={(e) =>
                updateSection(i, { body: linesToArray(e.target.value) })
              }
            />
          </Field>
        </div>
      ))}
      <Field label="ท้ายหน้า (footer)">
        <TextInput
          value={doc.footer ?? ""}
          onChange={(e) => onChange({ ...doc, footer: e.target.value })}
        />
      </Field>
    </div>
  );
}

function PaymentInfoEditor({
  info,
  onChange,
}: {
  info: CmsPaymentInfo;
  onChange: (v: CmsPaymentInfo) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="หัวข้อ">
        <TextInput
          value={info.title}
          onChange={(e) => onChange({ ...info, title: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ธนาคาร">
          <TextInput
            value={info.bankName}
            onChange={(e) => onChange({ ...info, bankName: e.target.value })}
          />
        </Field>
        <Field label="เลขบัญชี">
          <TextInput
            value={info.accountNumber}
            onChange={(e) => onChange({ ...info, accountNumber: e.target.value })}
          />
        </Field>
        <Field label="ชื่อบัญชี">
          <TextInput
            value={info.accountName}
            onChange={(e) => onChange({ ...info, accountName: e.target.value })}
          />
        </Field>
        <Field label="หมายเหตุยอดเงิน">
          <TextInput
            value={info.amountNote}
            onChange={(e) => onChange({ ...info, amountNote: e.target.value })}
          />
        </Field>
      </div>
      <Field label="ขั้นตอน (หนึ่งบรรทัดต่อขั้น)">
        <TextArea
          rows={5}
          value={arrayToLines(info.steps)}
          onChange={(e) =>
            onChange({ ...info, steps: linesToArray(e.target.value) })
          }
        />
      </Field>
      <Field label="ท้ายข้อความ">
        <TextInput
          value={info.footer ?? ""}
          onChange={(e) => onChange({ ...info, footer: e.target.value })}
        />
      </Field>
    </div>
  );
}
