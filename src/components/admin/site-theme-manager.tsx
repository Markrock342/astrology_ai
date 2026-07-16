"use client";

import { useState } from "react";
import { CMS_KEYS, type CmsSiteTheme } from "@/lib/cms-keys";
import {
  AdminPage,
  Button,
  Card,
  Field,
  ImageUploadField,
  InfoBox,
  PageHeader,
  Toggle,
  adminFetch,
} from "./ui";

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-0.5"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        />
      </div>
    </Field>
  );
}

const DEFAULTS: CmsSiteTheme = {
  enabled: false,
  primary: "#c9a24b",
  secondary: "#1f8f7a",
  backgroundDark: "#0d0d0f",
  backgroundLight: "#f3f4f6",
  markUrl: null,
  wordmarkUrl: null,
};

export function SiteThemeManager({ initial }: { initial: CmsSiteTheme }) {
  const [form, setForm] = useState<CmsSiteTheme>({
    ...DEFAULTS,
    ...initial,
    markUrl: initial.markUrl ?? null,
    wordmarkUrl: initial.wordmarkUrl ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const value: CmsSiteTheme = {
        ...form,
        markUrl: form.markUrl?.trim() || null,
        wordmarkUrl: form.wordmarkUrl?.trim() || null,
      };
      await adminFetch(`/api/admin/settings/${CMS_KEYS.siteTheme}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setSaved("เผยแพร่แล้ว — ผู้ใช้ทุกคนจะเห็นโลโก้และสีนี้ทั้งเว็บ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  function clearLogos() {
    setForm((f) => ({ ...f, markUrl: null, wordmarkUrl: null }));
  }

  return (
    <AdminPage>
      <PageHeader
        title="Logo & Theme"
        description="อัปโหลดโลโก้มุมซ้ายบน (ไอคอน + คำ) และตั้งสีแบรนด์ — ผู้ใช้ทั่วไปเห็นเหมือนกัน (ยังสลับมืด/สว่างเองได้)"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setForm(DEFAULTS)}
            >
              รีเซ็ตค่าเริ่มต้น
            </Button>
            <Button disabled={busy} onClick={() => void publish()}>
              {busy ? "กำลังบันทึก…" : "บันทึกและเผยแพร่"}
            </Button>
          </div>
        }
      />

      <InfoBox>
        โลโก้ที่อัปโหลดจะแทนที่รูปในมุมซ้ายบน (แชท / หน้าเข้าสู่ระบบ) — ถ้ายังไม่อัปโหลดหรือกดลบ
        ระบบกลับไปใช้โลโก้เดิมอัตโนมัติ เปิดสวิตช์สีด้านล่างแล้วกดเผยแพร่เพื่อทับธีมทั้งเว็บ
      </InfoBox>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}
      {saved && <p className="mb-4 text-sm text-[var(--secondary-active)]">{saved}</p>}

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--foreground)]">โลโก้เว็บ (มุมซ้ายบน)</p>
          <Button variant="ghost" disabled={busy} onClick={clearLogos}>
            ลบโลโก้ (กลับค่าเริ่มต้น)
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUploadField
            label="ไอคอน (mark)"
            hint="แนะนำสี่เหลี่ยม / PNG หรือ WebP — ว่าง = ใช้ /logo.png"
            value={form.markUrl ?? ""}
            onChange={(markUrl) =>
              setForm((f) => ({ ...f, markUrl: markUrl || null }))
            }
          />
          <ImageUploadField
            label="คำแบรนด์ (wordmark)"
            hint="ตัวอักษรแนวนอนข้างไอคอน — ว่าง = ใช้ /wordmark.png"
            value={form.wordmarkUrl ?? ""}
            onChange={(wordmarkUrl) =>
              setForm((f) => ({ ...f, wordmarkUrl: wordmarkUrl || null }))
            }
          />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.markUrl?.trim() || "/logo.png"}
            alt="preview mark"
            className="h-8 w-8 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.wordmarkUrl?.trim() || "/wordmark.png"}
            alt="preview wordmark"
            className="h-5 w-auto object-contain"
          />
          <span className="text-[10px] text-[var(--muted)]">ตัวอย่าง lockup</span>
        </div>
      </Card>

      <Card className="mb-4">
        <Toggle
          checked={form.enabled}
          onChange={(enabled) => setForm({ ...form, enabled })}
          label="ใช้สีคัสตอมทั้งเว็บ"
        />
      </Card>

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="สีหลัก"
            hint="ปุ่มเน้น / ลิงก์ / ไอคอน"
            value={form.primary}
            onChange={(primary) => setForm({ ...form, primary })}
          />
          <ColorField
            label="สีรอง"
            hint="เช่นปุ่มเริ่มสนทนาใหม่"
            value={form.secondary}
            onChange={(secondary) => setForm({ ...form, secondary })}
          />
          <ColorField
            label="พื้นหลังโหมดมืด"
            value={form.backgroundDark}
            onChange={(backgroundDark) => setForm({ ...form, backgroundDark })}
          />
          <ColorField
            label="พื้นหลังโหมดสว่าง"
            value={form.backgroundLight}
            onChange={(backgroundLight) =>
              setForm({ ...form, backgroundLight })
            }
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <PreviewSwatch
            label="ตัวอย่างโหมดมืด"
            primary={form.primary}
            secondary={form.secondary}
            background={form.backgroundDark}
          />
          <PreviewSwatch
            label="ตัวอย่างโหมดสว่าง"
            primary={form.primary}
            secondary={form.secondary}
            background={form.backgroundLight}
          />
        </div>
      </Card>
    </AdminPage>
  );
}

function PreviewSwatch({
  label,
  primary,
  secondary,
  background,
}: {
  label: string;
  primary: string;
  secondary: string;
  background: string;
}) {
  return (
    <div
      className="rounded-xl border border-[var(--border)] p-4"
      style={{ background }}
    >
      <p className="mb-3 text-[11px] text-white/70 mix-blend-difference">{label}</p>
      <div className="flex flex-wrap gap-2">
        <span
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: primary, color: "#1a1508" }}
        >
          สีหลัก
        </span>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: secondary, color: "#04120e" }}
        >
          สีรอง
        </span>
      </div>
    </div>
  );
}
