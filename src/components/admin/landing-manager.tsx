"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CmsKey,
  CmsLandingFeatures,
  CmsLandingHero,
  CmsLandingHowItWorks,
  CmsLandingPricingSection,
  CmsLandingTestimonials,
  CmsSiteFooter,
} from "@/lib/cms-keys";
import {
  CMS_DEFAULTS,
  CMS_KEYS,
  CMS_LABELS,
  LANDING_CMS_KEYS,
} from "@/lib/cms-keys";
import {
  ContentEditorToolbar,
  type ContentRevision,
} from "./content-editor-toolbar";
import { confirmLeave } from "./form-utils";
import {
  AdminPage,
  Button,
  Card,
  CharCounter,
  Field,
  ImageUploadField,
  InfoBox,
  PageHeader,
  Tabs,
  TextArea,
  TextInput,
  ToastHost,
  Toggle,
  adminFetch,
  useToast,
} from "./ui";

type SettingRow = {
  key: CmsKey;
  published: unknown;
  draft: unknown | null;
  hasDraft: boolean;
  value: unknown;
};

const TABS = LANDING_CMS_KEYS.map((key) => ({
  id: key,
  label: CMS_LABELS[key].replace(/^หน้าแรก — /, "").replace("ส่วนท้ายเว็บ (Footer)", "Footer"),
}));

function asHero(v: unknown): CmsLandingHero {
  return (v ?? CMS_DEFAULTS[CMS_KEYS.landingHero]) as CmsLandingHero;
}
function asFeatures(v: unknown): CmsLandingFeatures {
  return (v ?? CMS_DEFAULTS[CMS_KEYS.landingFeatures]) as CmsLandingFeatures;
}
function asHow(v: unknown): CmsLandingHowItWorks {
  return (v ?? CMS_DEFAULTS[CMS_KEYS.landingHowItWorks]) as CmsLandingHowItWorks;
}
function asPricing(v: unknown): CmsLandingPricingSection {
  return (v ?? CMS_DEFAULTS[CMS_KEYS.landingPricingSection]) as CmsLandingPricingSection;
}
function asTestimonials(v: unknown): CmsLandingTestimonials {
  return (v ?? CMS_DEFAULTS[CMS_KEYS.landingTestimonials]) as CmsLandingTestimonials;
}
function asFooter(v: unknown): CmsSiteFooter {
  return (v ?? CMS_DEFAULTS[CMS_KEYS.siteFooter]) as CmsSiteFooter;
}

export function LandingManager({
  initialRows,
}: {
  initialRows?: SettingRow[] | null;
}) {
  const { toast, showToast } = useToast();
  const [rows, setRows] = useState<SettingRow[]>(initialRows ?? []);
  const [activeKey, setActiveKey] = useState<CmsKey>(CMS_KEYS.landingHero);
  const [draft, setDraft] = useState<unknown>(() => {
    const row = initialRows?.find((r) => r.key === CMS_KEYS.landingHero);
    return structuredClone(row?.draft ?? row?.published ?? CMS_DEFAULTS[CMS_KEYS.landingHero]);
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialRows);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeRow = useMemo(
    () => rows.find((r) => r.key === activeKey),
    [rows, activeKey],
  );

  const loadRevisions = useCallback(async (key: CmsKey) => {
    const list = await adminFetch<ContentRevision[]>(
      `/api/admin/revisions?entityType=APP_SETTING&entityId=${encodeURIComponent(key)}`,
    );
    setRevisions(list);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<SettingRow[]>("/api/admin/settings");
      setRows(data.filter((r) => LANDING_CMS_KEYS.includes(r.key)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRows) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client fetch when SSR rows absent
    void load();
  }, [initialRows, load]);

  // Sync draft when CMS tab / rows change (intentional controlled reset).
  useEffect(() => {
    const row = rows.find((r) => r.key === activeKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset editor when switching CMS key
    setDraft(
      structuredClone(row ? (row.draft ?? row.published) : CMS_DEFAULTS[activeKey]),
    );
    void loadRevisions(activeKey).catch(() => setRevisions([]));
  }, [activeKey, rows, loadRevisions]);

  function selectTab(key: string) {
    if (key === activeKey) return;
    const currentBaseline = activeRow?.draft ?? activeRow?.published;
    const dirty = JSON.stringify(draft) !== JSON.stringify(currentBaseline);
    if (dirty && !confirmLeave()) return;
    setActiveKey(key as CmsKey);
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/settings/${activeKey}/draft`, {
        method: "PUT",
        body: JSON.stringify({ value: draft }),
      });
      showToast("บันทึกแบบร่างแล้ว");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "บันทึกแบบร่างไม่สำเร็จ";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/settings/${activeKey}/publish`, {
        method: "POST",
        body: JSON.stringify({ value: draft }),
      });
      showToast("เผยแพร่แล้ว");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "เผยแพร่ไม่สำเร็จ";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/settings/${activeKey}/discard-draft`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      showToast("ยกเลิกแบบร่างแล้ว");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }

  async function restore(revisionId: string, mode: "draft" | "publish") {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/revisions/${revisionId}/restore`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      showToast(mode === "publish" ? "กู้และเผยแพร่แล้ว" : "กู้เป็นแบบร่างแล้ว");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "กู้คืนไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <ToastHost toast={toast} />
      <PageHeader
        title="หน้าแรกและการตลาด"
        description="แก้เนื้อหา landing · footer — บันทึกแบบร่าง → ดูตัวอย่าง → เผยแพร่"
      />
      <InfoBox>
        ราคาบนหน้าแรกดึงจากเมนู “แพ็กเกจและโควตา” โดยตรง — ส่วนนี้แก้ได้เฉพาะหัวข้อและคำโปรย
      </InfoBox>
      {error && <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>}
      {loading ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">กำลังโหลด…</p>
        </Card>
      ) : (
        <>
          <Tabs tabs={TABS} active={activeKey} onChange={selectTab} />
          <ContentEditorToolbar
            hasDraft={Boolean(activeRow?.hasDraft)}
            dirty={
              JSON.stringify(draft) !==
              JSON.stringify(activeRow?.draft ?? activeRow?.published)
            }
            previewHref="/"
            busy={busy}
            onSaveDraft={() => void saveDraft()}
            onPublish={() => void publish()}
            onDiscardDraft={() => void discardDraft()}
            revisions={revisions}
            onRestore={(id, mode) => void restore(id, mode)}
            currentSnapshot={(draft as Record<string, unknown>) ?? null}
          />
          <Card>
            {activeKey === CMS_KEYS.landingHero && (
              <HeroEditor value={asHero(draft)} onChange={setDraft} />
            )}
            {activeKey === CMS_KEYS.landingFeatures && (
              <FeaturesEditor value={asFeatures(draft)} onChange={setDraft} />
            )}
            {activeKey === CMS_KEYS.landingHowItWorks && (
              <HowEditor value={asHow(draft)} onChange={setDraft} />
            )}
            {activeKey === CMS_KEYS.landingPricingSection && (
              <PricingEditor value={asPricing(draft)} onChange={setDraft} />
            )}
            {activeKey === CMS_KEYS.landingTestimonials && (
              <TestimonialsEditor value={asTestimonials(draft)} onChange={setDraft} />
            )}
            {activeKey === CMS_KEYS.siteFooter && (
              <FooterEditor value={asFooter(draft)} onChange={setDraft} />
            )}
          </Card>
        </>
      )}
    </AdminPage>
  );
}

function HeroEditor({
  value,
  onChange,
}: {
  value: CmsLandingHero;
  onChange: (v: CmsLandingHero) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Eyebrow">
        <TextInput
          value={value.eyebrow}
          onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
        />
      </Field>
      <Field label="หัวข้อหลัก">
        <div className="flex items-center gap-2">
          <TextInput
            value={value.headline}
            onChange={(e) => onChange({ ...value, headline: e.target.value })}
          />
          <CharCounter value={value.headline} max={120} />
        </div>
      </Field>
      <Field label="คำโปรย">
        <TextArea
          value={value.subheadline}
          onChange={(e) => onChange({ ...value, subheadline: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ปุ่มหลัก — ข้อความ">
          <TextInput
            value={value.primaryCta.text}
            onChange={(e) =>
              onChange({
                ...value,
                primaryCta: { ...value.primaryCta, text: e.target.value },
              })
            }
          />
        </Field>
        <Field label="ปุ่มหลัก — ลิงก์">
          <TextInput
            value={value.primaryCta.href}
            onChange={(e) =>
              onChange({
                ...value,
                primaryCta: { ...value.primaryCta, href: e.target.value },
              })
            }
          />
        </Field>
        <Field label="ปุ่มรอง — ข้อความ">
          <TextInput
            value={value.secondaryCta.text}
            onChange={(e) =>
              onChange({
                ...value,
                secondaryCta: { ...value.secondaryCta, text: e.target.value },
              })
            }
          />
        </Field>
        <Field label="ปุ่มรอง — ลิงก์">
          <TextInput
            value={value.secondaryCta.href}
            onChange={(e) =>
              onChange({
                ...value,
                secondaryCta: { ...value.secondaryCta, href: e.target.value },
              })
            }
          />
        </Field>
      </div>
      <ImageUploadField
        label="รูปประกอบ (ไม่บังคับ)"
        value={value.imageUrl ?? ""}
        onChange={(url) => onChange({ ...value, imageUrl: url })}
      />
    </div>
  );
}

function FeaturesEditor({
  value,
  onChange,
}: {
  value: CmsLandingFeatures;
  onChange: (v: CmsLandingFeatures) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="หัวข้อ">
        <TextInput
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="คำโปรย">
        <TextInput
          value={value.subtitle ?? ""}
          onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
        />
      </Field>
      {value.items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
        >
          <div className="flex justify-between">
            <p className="text-xs font-medium">จุดเด่น #{idx + 1}</p>
            <Button
              variant="danger"
              onClick={() =>
                onChange({
                  ...value,
                  items: value.items.filter((_, i) => i !== idx),
                })
              }
            >
              ลบ
            </Button>
          </div>
          <Field label="ไอคอน (อีโมจิหรือข้อความสั้น)">
            <TextInput
              value={item.icon}
              onChange={(e) => {
                const items = [...value.items];
                items[idx] = { ...item, icon: e.target.value };
                onChange({ ...value, items });
              }}
            />
          </Field>
          <Field label="ชื่อ">
            <TextInput
              value={item.title}
              onChange={(e) => {
                const items = [...value.items];
                items[idx] = { ...item, title: e.target.value };
                onChange({ ...value, items });
              }}
            />
          </Field>
          <Field label="คำอธิบาย">
            <TextArea
              value={item.description}
              onChange={(e) => {
                const items = [...value.items];
                items[idx] = { ...item, description: e.target.value };
                onChange({ ...value, items });
              }}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={idx === 0}
              onClick={() => {
                const items = [...value.items];
                [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
                onChange({ ...value, items });
              }}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              disabled={idx === value.items.length - 1}
              onClick={() => {
                const items = [...value.items];
                [items[idx + 1], items[idx]] = [items[idx], items[idx + 1]];
                onChange({ ...value, items });
              }}
            >
              ↓
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          onChange({
            ...value,
            items: [
              ...value.items,
              { icon: "✨", title: "หัวข้อใหม่", description: "คำอธิบาย" },
            ],
          })
        }
      >
        + เพิ่มจุดเด่น
      </Button>
    </div>
  );
}

function HowEditor({
  value,
  onChange,
}: {
  value: CmsLandingHowItWorks;
  onChange: (v: CmsLandingHowItWorks) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="หัวข้อ">
        <TextInput
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="คำโปรย">
        <TextInput
          value={value.subtitle ?? ""}
          onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
        />
      </Field>
      {value.steps.map((step, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
        >
          <div className="flex justify-between">
            <p className="text-xs font-medium">ขั้นตอน {idx + 1}</p>
            <Button
              variant="danger"
              onClick={() =>
                onChange({
                  ...value,
                  steps: value.steps.filter((_, i) => i !== idx),
                })
              }
            >
              ลบ
            </Button>
          </div>
          <Field label="ชื่อ">
            <TextInput
              value={step.title}
              onChange={(e) => {
                const steps = [...value.steps];
                steps[idx] = { ...step, title: e.target.value };
                onChange({ ...value, steps });
              }}
            />
          </Field>
          <Field label="คำอธิบาย">
            <TextArea
              value={step.description}
              onChange={(e) => {
                const steps = [...value.steps];
                steps[idx] = { ...step, description: e.target.value };
                onChange({ ...value, steps });
              }}
            />
          </Field>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          onChange({
            ...value,
            steps: [...value.steps, { title: "ขั้นตอนใหม่", description: "รายละเอียด" }],
          })
        }
      >
        + เพิ่มขั้นตอน
      </Button>
    </div>
  );
}

function PricingEditor({
  value,
  onChange,
}: {
  value: CmsLandingPricingSection;
  onChange: (v: CmsLandingPricingSection) => void;
}) {
  return (
    <div className="space-y-3">
      <Toggle
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
        label="แสดงส่วนราคาบนหน้าแรก"
      />
      <Field label="หัวข้อ">
        <TextInput
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="คำโปรย">
        <TextInput
          value={value.subtitle ?? ""}
          onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
        />
      </Field>
    </div>
  );
}

function TestimonialsEditor({
  value,
  onChange,
}: {
  value: CmsLandingTestimonials;
  onChange: (v: CmsLandingTestimonials) => void;
}) {
  return (
    <div className="space-y-3">
      <Toggle
        checked={value.enabled}
        onChange={(enabled) => onChange({ ...value, enabled })}
        label="แสดงส่วนรีวิวบนหน้าแรก"
      />
      <Field label="หัวข้อ">
        <TextInput
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Field>
      <Field label="คำโปรย">
        <TextInput
          value={value.subtitle ?? ""}
          onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
        />
      </Field>
      {value.items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
        >
          <div className="flex justify-between">
            <p className="text-xs font-medium">รีวิว #{idx + 1}</p>
            <Button
              variant="danger"
              onClick={() =>
                onChange({
                  ...value,
                  items: value.items.filter((_, i) => i !== idx),
                })
              }
            >
              ลบ
            </Button>
          </div>
          <Field label="ชื่อ">
            <TextInput
              value={item.name}
              onChange={(e) => {
                const items = [...value.items];
                items[idx] = { ...item, name: e.target.value };
                onChange({ ...value, items });
              }}
            />
          </Field>
          <Field label="ข้อความ">
            <TextArea
              value={item.quote}
              onChange={(e) => {
                const items = [...value.items];
                items[idx] = { ...item, quote: e.target.value };
                onChange({ ...value, items });
              }}
            />
          </Field>
          <Field label="ดาว (1–5)">
            <TextInput
              type="number"
              min={1}
              max={5}
              value={item.stars}
              onChange={(e) => {
                const items = [...value.items];
                items[idx] = {
                  ...item,
                  stars: Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                };
                onChange({ ...value, items });
              }}
            />
          </Field>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          onChange({
            ...value,
            items: [
              ...value.items,
              { name: "ชื่อ", quote: "ข้อความรีวิว", stars: 5 },
            ],
          })
        }
      >
        + เพิ่มรีวิว
      </Button>
    </div>
  );
}

function FooterEditor({
  value,
  onChange,
}: {
  value: CmsSiteFooter;
  onChange: (v: CmsSiteFooter) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="คำอธิบายแบรนด์">
        <TextArea
          value={value.brandBlurb}
          onChange={(e) => onChange({ ...value, brandBlurb: e.target.value })}
        />
      </Field>
      <Field label="บรรทัดลิขสิทธิ์">
        <TextInput
          value={value.copyright}
          onChange={(e) => onChange({ ...value, copyright: e.target.value })}
        />
      </Field>
      <p className="text-xs font-medium text-[var(--foreground)]">ลิงก์</p>
      {value.links.map((link, idx) => (
        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput
            value={link.label}
            placeholder="ชื่อลิงก์"
            onChange={(e) => {
              const links = [...value.links];
              links[idx] = { ...link, label: e.target.value };
              onChange({ ...value, links });
            }}
          />
          <TextInput
            value={link.href}
            placeholder="/path"
            onChange={(e) => {
              const links = [...value.links];
              links[idx] = { ...link, href: e.target.value };
              onChange({ ...value, links });
            }}
          />
          <Button
            variant="danger"
            onClick={() =>
              onChange({
                ...value,
                links: value.links.filter((_, i) => i !== idx),
              })
            }
          >
            ลบ
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          onChange({
            ...value,
            links: [...value.links, { label: "ลิงก์ใหม่", href: "/" }],
          })
        }
      >
        + เพิ่มลิงก์
      </Button>
      <p className="pt-2 text-xs font-medium text-[var(--foreground)]">โซเชียล (URL เต็ม)</p>
      {value.socialLinks.map((link, idx) => (
        <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <TextInput
            value={link.label}
            placeholder="เช่น Facebook"
            onChange={(e) => {
              const socialLinks = [...value.socialLinks];
              socialLinks[idx] = { ...link, label: e.target.value };
              onChange({ ...value, socialLinks });
            }}
          />
          <TextInput
            value={link.href}
            placeholder="https://…"
            onChange={(e) => {
              const socialLinks = [...value.socialLinks];
              socialLinks[idx] = { ...link, href: e.target.value };
              onChange({ ...value, socialLinks });
            }}
          />
          <Button
            variant="danger"
            onClick={() =>
              onChange({
                ...value,
                socialLinks: value.socialLinks.filter((_, i) => i !== idx),
              })
            }
          >
            ลบ
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          onChange({
            ...value,
            socialLinks: [
              ...value.socialLinks,
              { label: "Facebook", href: "https://facebook.com" },
            ],
          })
        }
      >
        + เพิ่มโซเชียล
      </Button>
    </div>
  );
}
