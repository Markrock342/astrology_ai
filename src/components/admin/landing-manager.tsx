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
  resolveHeroBackground,
  sampleThemeHeroPatch,
} from "@/lib/landing-hero-bg";
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
  Select,
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

function cloneDraft(value: unknown): unknown {
  if (value == null) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function asHero(v: unknown): CmsLandingHero {
  const defaults = CMS_DEFAULTS[CMS_KEYS.landingHero] as CmsLandingHero;
  const raw = (v && typeof v === "object" ? v : {}) as Partial<CmsLandingHero>;
  return {
    eyebrow: raw.eyebrow ?? defaults.eyebrow,
    headline: raw.headline ?? defaults.headline,
    subheadline: raw.subheadline ?? defaults.subheadline,
    primaryCta: { ...defaults.primaryCta, ...raw.primaryCta },
    secondaryCta: { ...defaults.secondaryCta, ...raw.secondaryCta },
    imageUrl: raw.imageUrl ?? defaults.imageUrl,
    backgroundType: raw.backgroundType ?? defaults.backgroundType ?? "none",
    backgroundImageUrl:
      raw.backgroundImageUrl ?? defaults.backgroundImageUrl ?? "",
    backgroundVideoUrl:
      raw.backgroundVideoUrl ?? defaults.backgroundVideoUrl ?? "",
    backgroundOverlay:
      raw.backgroundOverlay ?? defaults.backgroundOverlay ?? 55,
  };
}
function asFeatures(v: unknown): CmsLandingFeatures {
  const defaults = CMS_DEFAULTS[CMS_KEYS.landingFeatures] as CmsLandingFeatures;
  const raw = (v && typeof v === "object" ? v : {}) as Partial<CmsLandingFeatures>;
  return {
    title: raw.title ?? defaults.title,
    subtitle: raw.subtitle ?? defaults.subtitle,
    items: Array.isArray(raw.items) ? raw.items : defaults.items,
  };
}
function asHow(v: unknown): CmsLandingHowItWorks {
  const defaults = CMS_DEFAULTS[CMS_KEYS.landingHowItWorks] as CmsLandingHowItWorks;
  const raw = (v && typeof v === "object" ? v : {}) as Partial<CmsLandingHowItWorks>;
  return {
    title: raw.title ?? defaults.title,
    subtitle: raw.subtitle ?? defaults.subtitle,
    steps: Array.isArray(raw.steps) ? raw.steps : defaults.steps,
  };
}
function asPricing(v: unknown): CmsLandingPricingSection {
  const defaults = CMS_DEFAULTS[
    CMS_KEYS.landingPricingSection
  ] as CmsLandingPricingSection;
  const raw = (v && typeof v === "object" ? v : {}) as Partial<CmsLandingPricingSection>;
  return {
    title: raw.title ?? defaults.title,
    subtitle: raw.subtitle ?? defaults.subtitle,
    enabled: raw.enabled ?? defaults.enabled,
  };
}
function asTestimonials(v: unknown): CmsLandingTestimonials {
  const defaults = CMS_DEFAULTS[
    CMS_KEYS.landingTestimonials
  ] as CmsLandingTestimonials;
  const raw = (v && typeof v === "object" ? v : {}) as Partial<CmsLandingTestimonials>;
  return {
    title: raw.title ?? defaults.title,
    subtitle: raw.subtitle ?? defaults.subtitle,
    enabled: raw.enabled ?? defaults.enabled,
    items: Array.isArray(raw.items) ? raw.items : defaults.items,
  };
}
function asFooter(v: unknown): CmsSiteFooter {
  const defaults = CMS_DEFAULTS[CMS_KEYS.siteFooter] as CmsSiteFooter;
  const raw = (v && typeof v === "object" ? v : {}) as Partial<CmsSiteFooter>;
  return {
    brandBlurb: raw.brandBlurb ?? defaults.brandBlurb,
    copyright: raw.copyright ?? defaults.copyright,
    links: Array.isArray(raw.links) ? raw.links : defaults.links,
    socialLinks: Array.isArray(raw.socialLinks) ? raw.socialLinks : defaults.socialLinks,
  };
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
    return cloneDraft(row?.draft ?? row?.published ?? CMS_DEFAULTS[CMS_KEYS.landingHero]);
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
      cloneDraft(row ? (row.draft ?? row.published) : CMS_DEFAULTS[activeKey]),
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
        <strong className="font-medium text-[var(--foreground)]">ลำดับงาน:</strong>{" "}
        บันทึกแบบร่าง → กด «ดูตัวอย่าง» หรือ «ดูในแท็บนี้» (ถ้าล็อกอินอยู่ ห้ามเปิด{" "}
        <code className="text-[10px]">/</code> ตรง ๆ จะถูกพาไปแชท) → ตรวจแล้วค่อยเผยแพร่
        ผู้เยี่ยมชมทั่วไปเห็นเฉพาะเวอร์ชันที่เผยแพร่แล้ว · หลังเผยแพร่หน้าแรกอาจรีเฟรชช้าได้ถึง ~1
        นาที
      </InfoBox>
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
  const bgType = value.backgroundType ?? "none";
  const bg = resolveHeroBackground(value);

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

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--foreground)]">
            พื้นหลัง Hero (เต็มจอแรก)
          </p>
          <Button
            variant="ghost"
            onClick={() => onChange({ ...value, ...sampleThemeHeroPatch() })}
          >
            ใส่ตัวอย่างธีม
          </Button>
        </div>
        <Field
          label="ชนิดพื้นหลัง"
          hint="ซ้อนด้านหลังโลโก้และข้อความทั้งจอ — รูปอัปโหลดได้ · วิดีโอใช้ URL ไฟล์เท่านั้น"
        >
          <Select
            value={bgType}
            onChange={(e) =>
              onChange({
                ...value,
                backgroundType: e.target
                  .value as CmsLandingHero["backgroundType"],
              })
            }
          >
            <option value="none">ไม่มี (ใช้ไล่สีเดิม)</option>
            <option value="image">รูปภาพ</option>
            <option value="video">วิดีโอ</option>
          </Select>
        </Field>
        {bgType === "image" ? (
          <div className="mt-3">
            <ImageUploadField
              label="รูปพื้นหลัง"
              value={value.backgroundImageUrl ?? ""}
              onChange={(url) =>
                onChange({ ...value, backgroundImageUrl: url })
              }
              hint="อัปโหลด JPG/PNG/WebP หรือวาง URL / path เช่น /samples/…"
            />
            {bg.missingMedia ? (
              <p className="mt-1 text-[11px] text-[var(--danger)]">
                เลือกพื้นหลังรูปแล้วต้องอัปโหลดหรือวาง URL — ไม่งั้นหน้าแรกจะยังเป็นไล่สีเดิม
              </p>
            ) : null}
          </div>
        ) : null}
        {bgType === "video" ? (
          <div className="mt-3">
            <Field
              label="ลิงก์วิดีโอพื้นหลัง"
              hint="ต้องเป็น URL ไฟล์ .mp4 / .webm โดยตรง (เล่นอัตโนมัติ ปิดเสียง วนลูป) — ไม่รองรับ YouTube/Vimeo และยังอัปโหลดไฟล์วิดีโอใน CMS ไม่ได้"
            >
              <TextInput
                value={value.backgroundVideoUrl ?? ""}
                onChange={(e) =>
                  onChange({ ...value, backgroundVideoUrl: e.target.value })
                }
                placeholder="https://cdn.example.com/hero.mp4"
              />
            </Field>
            {bg.missingMedia ? (
              <p className="mt-1 text-[11px] text-[var(--danger)]">
                เลือกพื้นหลังวิดีโอแล้วต้องมี URL ไฟล์ — ไม่งั้นหน้าแรกจะยังเป็นไล่สีเดิม
              </p>
            ) : null}
            {bg.invalidVideoUrl ? (
              <p className="mt-1 text-[11px] text-[var(--danger)]">
                ลิงก์นี้ไม่ใช่ไฟล์วิดีโอโดยตรง (เช่น YouTube) — วางลิงก์ที่ลงท้าย .mp4 หรือ .webm
              </p>
            ) : null}
          </div>
        ) : null}
        {bgType !== "none" ? (
          <div className="mt-3">
            <Field
              label={`ความมืดทับพื้นหลัง (${value.backgroundOverlay ?? 55}%)`}
              hint="ยิ่งสูง ข้อความยิ่งอ่านง่าย"
            >
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={value.backgroundOverlay ?? 55}
                onChange={(e) =>
                  onChange({
                    ...value,
                    backgroundOverlay: Number(e.target.value),
                  })
                }
                className="w-full accent-[var(--primary)]"
              />
            </Field>
          </div>
        ) : null}

        {bgType !== "none" ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)] bg-black/40">
            <p className="border-b border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted-2)]">
              พรีวิวย่อในแอดมิน
            </p>
            <div className="relative aspect-video w-full">
              {bg.imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail; CMS URLs vary
                <img
                  src={bg.imageSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              {bg.videoSrc ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src={bg.videoSrc}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="metadata"
                />
              ) : null}
              {!bg.hasFullBleed ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(201,162,75,0.18),transparent_55%)] px-3 text-center text-[11px] text-[var(--muted)]">
                  {bg.missingMedia || bg.invalidVideoUrl
                    ? "ยังไม่แสดงพื้นหลังเต็มจอ — แก้ URL ด้านบน"
                    : "ไล่สีเดิม (ไม่มีมีเดีย)"}
                </div>
              ) : (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `rgba(8, 8, 12, ${bg.overlay / 100})`,
                  }}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      {bgType === "none" ? (
        <ImageUploadField
          label="รูปประกอบด้านล่าง (ไม่บังคับ)"
          value={value.imageUrl ?? ""}
          onChange={(url) => onChange({ ...value, imageUrl: url })}
          hint="แสดงใต้ปุ่มเมื่อไม่มีพื้นหลังเต็มจอ"
        />
      ) : null}
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
