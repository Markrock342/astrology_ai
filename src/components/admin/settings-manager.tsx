"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CmsContact,
  CmsDocument,
  CmsKey,
  CmsMaintenance,
  CmsPaymentInfo,
  CmsSection,
  CmsSeo,
  CmsText,
} from "@/lib/cms-keys";
import {
  CMS_GROUPS,
  CMS_KEYS,
  CMS_LABELS,
  CMS_META,
  LANDING_CMS_KEYS,
  cmsKeysInGroup,
} from "@/lib/cms-keys";
import {
  ContentEditorToolbar,
  type ContentRevision,
} from "./content-editor-toolbar";
import { arrayToLines, confirmLeave, linesToArray } from "./form-utils";
import {
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  CharCounter,
  Field,
  ImageUploadField,
  InfoBox,
  NavGroupLabel,
  PageHeader,
  TextArea,
  TextInput,
  Toggle,
  adminFetch,
} from "./ui";

type SettingRow = {
  key: CmsKey;
  published: unknown;
  draft: unknown | null;
  hasDraft: boolean;
  value: unknown;
  updatedAt: string | null;
  draftUpdatedAt: string | null;
  isDefault: boolean;
};

export function SettingsManager({
  initialRows,
}: {
  initialRows?: SettingRow[] | null;
}) {
  const [rows, setRows] = useState<SettingRow[]>(initialRows ?? []);
  const [activeKey, setActiveKey] = useState<CmsKey>(CMS_KEYS.privacyPolicy);
  const [draft, setDraft] = useState<unknown>(() => {
    const current = initialRows?.find((r) => r.key === CMS_KEYS.privacyPolicy);
    return current ? structuredClone(current.draft ?? current.published) : null;
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialRows);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);

  const loadRevisions = useCallback(async (key: CmsKey) => {
    const rows = await adminFetch<ContentRevision[]>(
      `/api/admin/revisions?entityType=APP_SETTING&entityId=${encodeURIComponent(key)}`,
    );
    setRevisions(rows);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminFetch<SettingRow[]>("/api/admin/settings");
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRows) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [initialRows, load]);

  // Sync draft + revisions when switching CMS key (do not reload all settings).
  useEffect(() => {
    const current = rows.find((r) => r.key === activeKey);
    if (current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset editor when switching CMS key
      setDraft(structuredClone(current.draft ?? current.published));
    }
    void loadRevisions(activeKey).catch(() => setRevisions([]));
  }, [activeKey, rows, loadRevisions]);

  function selectKey(key: CmsKey) {
    if (key === activeKey) return;
    const current = rows.find((r) => r.key === activeKey);
    const baseline = current?.draft ?? current?.published;
    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
    if (dirty && !confirmLeave()) return;
    setActiveKey(key);
    setSaved(null);
    const row = rows.find((r) => r.key === key);
    setDraft(row ? structuredClone(row.draft ?? row.published) : null);
    void loadRevisions(key);
  }

  async function saveDraft() {
    if (draft == null) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await adminFetch(`/api/admin/settings/${activeKey}/draft`, {
        method: "PUT",
        body: JSON.stringify({ value: draft }),
      });
      setSaved("draft");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกแบบร่างไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (draft == null) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await adminFetch(`/api/admin/settings/${activeKey}/publish`, {
        method: "POST",
        body: JSON.stringify({ value: draft }),
      });
      setSaved("published");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เผยแพร่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    setBusy(true);
    setError(null);
    try {
      const row = await adminFetch<SettingRow>(
        `/api/admin/settings/${activeKey}/discard-draft`,
        { method: "POST" },
      );
      setDraft(structuredClone(row.published));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยกเลิกแบบร่างไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function restoreRevision(revisionId: string, mode: "draft" | "publish") {
    setBusy(true);
    setError(null);
    try {
      const row = await adminFetch<SettingRow>(`/api/admin/revisions/${revisionId}/restore`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setDraft(structuredClone(row.draft ?? row.published));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "กู้คืนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const activeRow = rows.find((r) => r.key === activeKey);
  const meta = CMS_META[activeKey];

  return (
    <AdminPage>
      <PageHeader
        title="แก้ข้อความบนเว็บ"
        description="เลือกรายการทางซ้าย → แก้ข้อความ → กดบันทึก — มีผลทันที ไม่ต้อง deploy ใหม่"
      />

      <InfoBox>
        <strong className="text-[var(--foreground)]">วิธีใช้:</strong>{" "}
        แก้ข้อความ → <strong className="text-[var(--foreground)]">บันทึกแบบร่าง</strong> →{" "}
        <strong className="text-[var(--foreground)]">ดูตัวอย่าง</strong> →{" "}
        <strong className="text-[var(--foreground)]">เผยแพร่</strong> เมื่อพร้อม — ผู้ใช้เห็นเฉพาะเวอร์ชันที่เผยแพร่แล้ว
      </InfoBox>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      {saved === "draft" && (
        <p className="mb-4 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-sm text-[var(--primary)]">
          บันทึกแบบร่างแล้ว — ยังไม่แสดงต่อผู้ใช้
        </p>
      )}
      {saved === "published" && (
        <p className="mb-4 rounded-lg border border-[var(--secondary-active)]/30 bg-[var(--secondary-active)]/10 px-3 py-2 text-sm text-[var(--secondary-active)]">
          เผยแพร่แล้ว — ผู้ใช้เห็นข้อความใหม่ทันที
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="!p-2">
          <InfoBox>
            เนื้อหาหน้าแรกแก้ไขที่{" "}
            <Link href="/admin/landing" className="text-[var(--primary)] underline">
              หน้าแรกและการตลาด
            </Link>
          </InfoBox>
          <nav className="flex flex-col">
            {CMS_GROUPS.filter((g) => g.id !== "landing").map((group) => (
              <div key={group.id}>
                <NavGroupLabel hint={group.hint}>{group.label}</NavGroupLabel>
                <div className="flex flex-col gap-0.5 pb-2">
                  {cmsKeysInGroup(group.id)
                    .filter((key) => !LANDING_CMS_KEYS.includes(key))
                    .map((key) => {
                    const row = rows.find((r) => r.key === key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectKey(key)}
                        className={`rounded-lg px-3 py-2 text-left transition ${
                          activeKey === key
                            ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                            : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span className="block text-xs font-medium">{CMS_LABELS[key]}</span>
                        {row?.isDefault && (
                          <span className="mt-0.5 block text-[10px] text-[var(--muted-2)]">
                            ค่าเริ่มต้น
                          </span>
                        )}
                        {row?.hasDraft && (
                          <span className="mt-0.5 block text-[10px] text-[var(--primary)]">
                            มีแบบร่าง
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </Card>

        <Card>
          <div className="mb-5 border-b border-[var(--border)] pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  {CMS_LABELS[activeKey]}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {meta.help}
                </p>
                <p className="mt-2 text-[11px] text-[var(--muted-2)]">
                  แสดงที่: {meta.where}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeRow?.isDefault && <Badge tone="muted">ค่าเริ่มต้น (เผยแพร่)</Badge>}
                {activeRow?.hasDraft && <Badge tone="gold">มีแบบร่าง</Badge>}
                {activeRow?.updatedAt && (
                  <span className="text-[10px] text-[var(--muted-2)]">
                    เผยแพร่ล่าสุด{" "}
                    {new Date(activeRow.updatedAt).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                    })}
                  </span>
                )}
                {meta.previewPath && (
                  <button
                    type="button"
                    onClick={() => {
                      void fetch("/api/admin/preview/enable", { method: "POST" })
                        .then(() =>
                          window.open(meta.previewPath, "_blank", "noopener,noreferrer"),
                        )
                        .catch(() =>
                          window.open(meta.previewPath, "_blank", "noopener,noreferrer"),
                        );
                    }}
                    className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--primary)] hover:bg-[var(--surface-2)]"
                  >
                    ดูตัวอย่าง ↗
                  </button>
                )}
              </div>
            </div>
          </div>

          <ContentEditorToolbar
            hasDraft={activeRow?.hasDraft ?? false}
            previewHref={meta.previewPath}
            busy={busy}
            onSaveDraft={() => void saveDraft()}
            onPublish={() => void publish()}
            onDiscardDraft={() => void discardDraft()}
            revisions={revisions}
            onRestore={(id, mode) => void restoreRevision(id, mode)}
            currentSnapshot={(draft as Record<string, unknown>) ?? null}
          />

          {draft != null && (
            <SettingEditor
              settingKey={activeKey}
              value={draft}
              onChange={setDraft}
            />
          )}

          <p className="mt-6 text-[11px] text-[var(--muted-2)]">
            ใช้ปุ่มด้านบนเพื่อบันทึกแบบร่าง / เผยแพร่ / กู้คืนเวอร์ชันเก่า
          </p>
        </Card>
      </div>
      )}
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
    settingKey === CMS_KEYS.termsOfService ||
    settingKey === CMS_KEYS.disclaimer
  ) {
    return (
      <DocumentEditor
        doc={value as CmsDocument}
        onChange={onChange}
      />
    );
  }
  if (
    settingKey === CMS_KEYS.consentRegister ||
    settingKey === CMS_KEYS.consentBirthPrivacy ||
    settingKey === CMS_KEYS.consentBirthEditLimit
  ) {
    const v = value as CmsText;
    return (
      <Field
        label="ข้อความที่แสดง"
        hint="เขียนให้สั้น ชัดเจน — ผู้ใช้จะเห็นตามที่ตั้งไว้"
      >
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
        <Field label="อีเมลติดต่อ" hint="ที่ผู้ใช้ส่งคำถามหรือขอลบบัญชี">
          <TextInput
            type="email"
            value={v.email}
            onChange={(e) => onChange({ ...v, email: e.target.value })}
          />
        </Field>
        <Field label="ชื่อทีมงาน (แสดงข้างอีเมล)">
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
          label="ปิดแอปชั่วคราว (ผู้ใช้ทั่วไปเข้าไม่ได้ — แอดมินยังเข้าได้)"
        />
        <Field
          label="ข้อความที่ผู้ใช้เห็น"
          hint="แสดงเมื่อเปิดโหมดปิดปรับปรุง"
        >
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
  if (
    settingKey === CMS_KEYS.seoHome ||
    settingKey === CMS_KEYS.seoPrivacy ||
    settingKey === CMS_KEYS.seoTerms ||
    settingKey === CMS_KEYS.seoDisclaimer ||
    settingKey === CMS_KEYS.seoFaq ||
    settingKey === CMS_KEYS.seoPricing ||
    settingKey === CMS_KEYS.seoContact
  ) {
    return <SeoEditor seo={value as CmsSeo} onChange={onChange} />;
  }
  return null;
}

function SeoEditor({
  seo,
  onChange,
}: {
  seo: CmsSeo;
  onChange: (v: CmsSeo) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title (แท็บเบราว์เซอร์)" hint="แนะนำไม่เกิน 60 ตัวอักษร">
        <div className="flex items-center gap-2">
          <TextInput
            value={seo.title}
            onChange={(e) => onChange({ ...seo, title: e.target.value })}
          />
          <CharCounter value={seo.title} max={60} />
        </div>
      </Field>
      <Field label="Meta description" hint="แนะนำไม่เกิน 160 ตัวอักษร">
        <div className="space-y-1">
          <TextArea
            rows={2}
            value={seo.description}
            onChange={(e) => onChange({ ...seo, description: e.target.value })}
          />
          <CharCounter value={seo.description} max={160} />
        </div>
      </Field>
      <Field label="OG title (Facebook/LINE)" hint="ว่าง = ใช้ title">
        <div className="flex items-center gap-2">
          <TextInput
            value={seo.ogTitle ?? ""}
            onChange={(e) => onChange({ ...seo, ogTitle: e.target.value || undefined })}
          />
          <CharCounter value={seo.ogTitle ?? ""} max={60} />
        </div>
      </Field>
      <Field label="OG description">
        <div className="space-y-1">
          <TextArea
            rows={2}
            value={seo.ogDescription ?? ""}
            onChange={(e) => onChange({ ...seo, ogDescription: e.target.value || undefined })}
          />
          <CharCounter value={seo.ogDescription ?? ""} max={160} />
        </div>
      </Field>
      <div className="sm:col-span-2">
        <ImageUploadField
          label="OG image"
          value={seo.ogImageUrl ?? ""}
          onChange={(url) => onChange({ ...seo, ogImageUrl: url || undefined })}
          hint="รูปเมื่อแชร์ลิงก์ — อัปโหลดหรือวาง URL"
        />
      </div>
    </div>
  );
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
        <Field label="ชื่อหน้า (หัวข้อใหญ่)">
          <TextInput
            value={doc.title}
            onChange={(e) => onChange({ ...doc, title: e.target.value })}
          />
        </Field>
        <Field label="วันที่ปรับปรุง (แสดงใต้หัวข้อ)">
          <TextInput
            value={doc.lastUpdated}
            onChange={(e) => onChange({ ...doc, lastUpdated: e.target.value })}
          />
        </Field>
      </div>
      <Field label="ย่อหน้าเปิด (บทนำ)" hint="ย่อหน้าแรกก่อนรายการหัวข้อ">
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-[var(--muted)]">
              หัวข้อที่ {i + 1}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                disabled={i === 0}
                onClick={() => {
                  const sections = [...doc.sections];
                  [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]];
                  onChange({ ...doc, sections });
                }}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                disabled={i === doc.sections.length - 1}
                onClick={() => {
                  const sections = [...doc.sections];
                  [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]];
                  onChange({ ...doc, sections });
                }}
              >
                ↓
              </Button>
              <Button
                variant="danger"
                disabled={doc.sections.length <= 1}
                onClick={() =>
                  onChange({
                    ...doc,
                    sections: doc.sections.filter((_, idx) => idx !== i),
                  })
                }
              >
                ลบ
              </Button>
            </div>
          </div>
          <Field label="ชื่อหัวข้อ">
            <TextInput
              value={section.heading}
              onChange={(e) => updateSection(i, { heading: e.target.value })}
            />
          </Field>
          <Field
            label="รายการเนื้อหา"
            hint="หนึ่งบรรทัด = หนึ่ง bullet บนหน้าเว็บ · รองรับ **ตัวหนา** และ [ลิงก์](url)"
          >
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
      <Button
        variant="ghost"
        onClick={() =>
          onChange({
            ...doc,
            sections: [
              ...doc.sections,
              { heading: `${doc.sections.length + 1}. หัวข้อใหม่`, body: ["รายละเอียด"] },
            ],
          })
        }
      >
        + เพิ่มหัวข้อ
      </Button>
      <Field label="ข้อความท้ายหน้า (ไม่บังคับ)">
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
      <Field label="หัวข้อบล็อกชำระเงิน" hint="แสดงด้านบนในหน้าบัญชีผู้ใช้">
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
        <Field label="หมายเหตุยอดเงิน" hint="เช่น โอนตามราคา Pro ที่แสดง">
          <TextInput
            value={info.amountNote}
            onChange={(e) => onChange({ ...info, amountNote: e.target.value })}
          />
        </Field>
      </div>
      <Field label="ขั้นตอนสำหรับผู้ใช้" hint="หนึ่งบรรทัด = หนึ่งขั้นตอน">
        <TextArea
          rows={5}
          value={arrayToLines(info.steps)}
          onChange={(e) =>
            onChange({ ...info, steps: linesToArray(e.target.value) })
          }
        />
      </Field>
      <Field label="ข้อความท้าย (ไม่บังคับ)">
        <TextInput
          value={info.footer ?? ""}
          onChange={(e) => onChange({ ...info, footer: e.target.value })}
        />
      </Field>
    </div>
  );
}
