"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminFetch,
  AdminPage,
  Badge,
  Button,
  Card,
  CardSkeleton,
  Field,
  InfoBox,
  PageHeader,
  Select,
  TextArea,
  TextInput,
  Toggle,
  IconTile,
} from "../admin/ui";
import { Archive, CalendarClock, Gift, Package } from "lucide-react";
import {
  questionsToUnits,
  typicalQuestionThb,
  unitsToQuestions,
} from "@/lib/usage-budget-display";
import {
  FALLBACK_PACK_EXPIRY,
  packExpiryLabel,
  packExpiryRule,
  type PackExpiryRule,
} from "@/lib/pack-expiry";

type ExpiryMode = "DEFAULT" | "NONE" | "DAYS" | "DATE";

/** What a pack costs us at the measured typical question, and what is left. */
function packEconomics(price: number, questions: number) {
  const cost = questions * typicalQuestionThb();
  const profit = price - cost;
  return {
    cost,
    profit,
    margin: price > 0 ? Math.round((profit / price) * 100) : null,
    perQuestion: questions > 0 ? price / questions : null,
  };
}

const baht = (v: number) => `฿${(Math.round(v * 100) / 100).toLocaleString("th-TH")}`;

/** A date picker value (Bangkok day) → the end of that day. */
const endOfDayIso = (day: string) => new Date(`${day}T23:59:59+07:00`).toISOString();
const dayOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) : "";

type Package = {
  id: string;
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel: string | null;
  creditQuota: number;
  usageBudgetUnits: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  enabled: boolean;
  description: string | null;
  features: string[];
  upgradeSteps: string[];
  creditOnly?: boolean;
  questionPack?: boolean;
  expiryMode?: ExpiryMode;
  expiryDays?: number | null;
  expiresOn?: string | null;
};

type FormState = {
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel: string;
  creditQuota: number;
  usageBudgetUnits: number;
  dailyLimit: string;
  monthlyLimit: string;
  enabled: boolean;
  description: string;
  featuresText: string;
  upgradeStepsText: string;
  questionPack: boolean;
  expiryMode: ExpiryMode;
  expiryDays: string;
  expiresOn: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  type: "PRO",
  price: 0,
  billingLabel: "",
  creditQuota: 0,
  usageBudgetUnits: 0,
  dailyLimit: "",
  monthlyLimit: "",
  enabled: true,
  description: "",
  featuresText: "",
  upgradeStepsText: "",
  questionPack: true,
  expiryMode: "DEFAULT",
  expiryDays: "30",
  expiresOn: "",
};

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PackagesManager({
  initialPackages,
}: {
  initialPackages?: Package[] | null;
}) {
  const [packages, setPackages] = useState<Package[]>(initialPackages ?? []);
  // editingId: null = closed, "new" = creating, otherwise package id.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialPackages);
  const [defaultExpiry, setDefaultExpiry] = useState<PackExpiryRule>(FALLBACK_PACK_EXPIRY);
  const [expiryDraft, setExpiryDraft] = useState<{ mode: "NONE" | "DAYS" | "DATE"; days: string; date: string }>({
    mode: "NONE",
    days: "30",
    date: "",
  });
  const [expirySaved, setExpirySaved] = useState(false);

  useEffect(() => {
    adminFetch<PackExpiryRule>("/api/admin/packages/default-expiry")
      .then((rule) => {
        setDefaultExpiry(rule);
        setExpiryDraft({
          mode: rule.mode,
          days: rule.mode === "DAYS" ? String(rule.days) : "30",
          date: rule.mode === "DATE" ? dayOf(rule.date) : "",
        });
      })
      .catch(() => {});
  }, []);

  async function saveDefaultExpiry() {
    const body =
      expiryDraft.mode === "DAYS"
        ? { mode: "DAYS", days: Number(expiryDraft.days) }
        : expiryDraft.mode === "DATE"
          ? { mode: "DATE", date: expiryDraft.date ? endOfDayIso(expiryDraft.date) : "" }
          : { mode: "NONE" };
    setBusy(true);
    setError(null);
    setExpirySaved(false);
    try {
      setDefaultExpiry(
        await adminFetch<PackExpiryRule>("/api/admin/packages/default-expiry", {
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
      setExpirySaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPackages(await adminFetch<Package[]>("/api/admin/packages"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPackages) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [initialPackages, load]);

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
      usageBudgetUnits: pkg.usageBudgetUnits,
      dailyLimit: pkg.dailyLimit == null ? "" : String(pkg.dailyLimit),
      monthlyLimit: pkg.monthlyLimit == null ? "" : String(pkg.monthlyLimit),
      enabled: pkg.enabled,
      description: pkg.description ?? "",
      featuresText: (pkg.features ?? []).join("\n"),
      upgradeStepsText: (pkg.upgradeSteps ?? []).join("\n"),
      questionPack: Boolean(pkg.questionPack),
      expiryMode: pkg.expiryMode ?? "DEFAULT",
      expiryDays: pkg.expiryDays ? String(pkg.expiryDays) : "30",
      expiresOn: dayOf(pkg.expiresOn ?? null),
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
      usageBudgetUnits: Number(form.usageBudgetUnits),
      // Message-count caps are retired (usage is the only limit); saving a
      // package clears any left over, such as the Free row's old 3/day.
      dailyLimit: null,
      monthlyLimit: null,
      enabled: form.enabled,
      description: form.description || undefined,
      features: linesToArray(form.featuresText),
      upgradeSteps: linesToArray(form.upgradeStepsText),
      ...(form.code === "FREE" || form.type === "FREE"
        ? {}
        : {
            questionPack: form.questionPack,
            expiryMode: form.expiryMode,
            expiryDays: form.expiryMode === "DAYS" ? Number(form.expiryDays) : null,
            expiresOn: form.expiryMode === "DATE" && form.expiresOn ? endOfDayIso(form.expiresOn) : null,
          }),
    };
    if (form.questionPack && form.expiryMode === "DATE" && !form.expiresOn) {
      setBusy(false);
      setError("เลือกวันหมดอายุของแพ็กนี้");
      return;
    }
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
        title="แพ็กเกจ & คำถาม"
        description="ตั้งราคา จำนวนคำถาม และวันหมดอายุ — มีผลกับการซื้อครั้งถัดไป คนที่ซื้อไปแล้วไม่เปลี่ยน"
        action={<Button onClick={startCreate}>+ สร้างแพ็ก</Button>}
      />

      <InfoBox>
        ถาม 1 ครั้ง = <strong className="text-[var(--foreground)]">1 คำถาม</strong> ไม่ว่าคำตอบยาวแค่ไหน ·{" "}
        <strong className="text-[var(--foreground)]">แพ็กคำถาม</strong> = ซื้อครั้งเดียว คำถามบวกเพิ่มจากที่เหลือ
        และเปิดทุกหมวด (ดวงจร ดวงคู่) จนกว่าคำถามจะหมดอายุ ·{" "}
        <strong className="text-[var(--foreground)]">Free</strong> = คำถามทดลองตอนสมัคร · ต้นทุนคิดจากคำถามทั่วไปราว{" "}
        {baht(typicalQuestionThb())} ต่อข้อ (วัดจริง) — คำตอบยาวหรือดวงคู่ใช้มากกว่า
      </InfoBox>

      <Card className="mb-4">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[var(--foreground)]">
          <IconTile icon={CalendarClock} tone="blue" size="sm" />
          วันหมดอายุเริ่มต้นของแพ็กคำถาม
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          ใช้กับทุกแพ็กที่ตั้งเป็น «ใช้ค่าเริ่มต้น» · ตอนนี้: <b className="text-[var(--foreground)]">{packExpiryLabel(defaultExpiry)}</b>
          {" "}· ซื้อเพิ่มแล้ววันหมดอายุของคำถามทั้งหมดเลื่อนไปตามแพ็กล่าสุด (ไม่สั้นลง)
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="แบบ">
            <Select
              value={expiryDraft.mode}
              onChange={(e) => setExpiryDraft({ ...expiryDraft, mode: e.target.value as "NONE" | "DAYS" | "DATE" })}
            >
              <option value="NONE">ไม่มีหมดอายุ</option>
              <option value="DAYS">หมดอายุหลังได้รับ … วัน</option>
              <option value="DATE">หมดอายุวันที่ …</option>
            </Select>
          </Field>
          {expiryDraft.mode === "DAYS" ? (
            <Field label="จำนวนวัน" hint="1 เดือน = 30">
              <TextInput
                type="number"
                min={1}
                value={expiryDraft.days}
                onChange={(e) => setExpiryDraft({ ...expiryDraft, days: e.target.value })}
              />
            </Field>
          ) : null}
          {expiryDraft.mode === "DATE" ? (
            <Field label="วันที่ (สิ้นวัน เวลาไทย)">
              <TextInput
                type="date"
                value={expiryDraft.date}
                onChange={(e) => setExpiryDraft({ ...expiryDraft, date: e.target.value })}
              />
            </Field>
          ) : null}
          <Button onClick={() => void saveDefaultExpiry()} disabled={busy || (expiryDraft.mode === "DATE" && !expiryDraft.date)}>
            บันทึกค่าเริ่มต้น
          </Button>
          {expirySaved ? <span className="text-xs text-[var(--secondary-active)]">บันทึกแล้ว</span> : null}
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      {loading && !editingId && (
        <div className="flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {editingId && (
        <Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {editingId === "new" && (
              <>
                <Field label="รหัสภายใน (ภาษาอังกฤษ)" hint="เช่น PRO_YEARLY — ใช้ในระบบ ห้ามซ้ำ">
                  <TextInput
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </Field>
                <Field label="ประเภทแพ็กเกจ">
                  <Select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as "FREE" | "PRO" })
                    }
                  >
                    <option value="FREE">ฟรี (Free)</option>
                    <option value="PRO">ขาย (แพ็กคำถาม / Pro)</option>
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
            <Field label="ป้ายราคา" hint="เช่น ครั้งเดียว, ต่อเดือน">
              <TextInput
                value={form.billingLabel}
                onChange={(e) => setForm({ ...form, billingLabel: e.target.value })}
              />
            </Field>
            <Field
              label={form.questionPack ? "จำนวนคำถามในแพ็ก" : "จำนวนคำถาม (ต่อรอบ / ทดลอง)"}
              hint={(() => {
                const q = unitsToQuestions(form.usageBudgetUnits);
                const e = packEconomics(Number(form.price), q);
                return form.price > 0 && q > 0
                  ? `฿${(e.perQuestion ?? 0).toFixed(2)}/คำถาม · ต้นทุน ≈ ${baht(e.cost)} · กำไร ≈ ${baht(e.profit)} (${e.margin}%)`
                  : `ต้นทุน ≈ ${baht(e.cost)}`;
              })()}
            >
              <TextInput
                type="number"
                min={0}
                value={unitsToQuestions(form.usageBudgetUnits)}
                onChange={(e) =>
                  setForm({ ...form, usageBudgetUnits: questionsToUnits(Number(e.target.value)) })
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
          {form.code !== "FREE" && form.type !== "FREE" ? (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex items-end">
                <Toggle
                  checked={form.questionPack}
                  onChange={(v) => setForm({ ...form, questionPack: v })}
                  label="แพ็กคำถาม (ซื้อครั้งเดียว บวกเพิ่ม)"
                />
              </div>
              {form.questionPack ? (
                <Field label="วันหมดอายุของแพ็กนี้">
                  <Select
                    value={form.expiryMode}
                    onChange={(e) => setForm({ ...form, expiryMode: e.target.value as ExpiryMode })}
                  >
                    <option value="DEFAULT">ใช้ค่าเริ่มต้น ({packExpiryLabel(defaultExpiry)})</option>
                    <option value="NONE">ไม่มีหมดอายุ</option>
                    <option value="DAYS">หมดอายุหลังได้รับ … วัน</option>
                    <option value="DATE">หมดอายุวันที่ …</option>
                  </Select>
                </Field>
              ) : null}
              {form.questionPack && form.expiryMode === "DAYS" ? (
                <Field label="จำนวนวัน" hint="1 เดือน = 30">
                  <TextInput
                    type="number"
                    min={1}
                    value={form.expiryDays}
                    onChange={(e) => setForm({ ...form, expiryDays: e.target.value })}
                  />
                </Field>
              ) : null}
              {form.questionPack && form.expiryMode === "DATE" ? (
                <Field label="วันที่ (สิ้นวัน เวลาไทย)">
                  <TextInput
                    type="date"
                    value={form.expiresOn}
                    onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
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
              label="ขั้นตอนการโอน / ซื้อ"
              hint="หนึ่งบรรทัดต่อหนึ่งขั้นตอน — แสดงเหนือฟอร์มส่งสลิป"
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
              <IconTile
                icon={pkg.questionPack ? Package : pkg.type === "FREE" ? Gift : Archive}
                tone={pkg.questionPack ? "gold" : pkg.type === "FREE" ? "green" : "muted"}
                size="sm"
              />
              <span className="text-sm font-medium text-[var(--foreground)]">
                {pkg.name}
              </span>
              <Badge tone="gold">
                {pkg.questionPack ? "แพ็กคำถาม" : pkg.creditOnly ? "เติม (เดิม)" : pkg.type === "PRO" ? "Pro รายเดือน (เดิม)" : "ฟรี"}
              </Badge>
              <Badge>฿{pkg.price}</Badge>
              {(() => {
                const q = unitsToQuestions(pkg.usageBudgetUnits);
                const e = packEconomics(pkg.price, q);
                return (
                  <Badge>
                    {q.toLocaleString("th-TH")} คำถาม
                    {e.perQuestion != null && pkg.price > 0
                      ? ` · ฿${e.perQuestion.toFixed(2)}/คำถาม · ต้นทุน ≈ ${baht(e.cost)} · กำไร ≈ ${e.margin}%`
                      : ` · ต้นทุน ≈ ${baht(e.cost)}`}
                  </Badge>
                );
              })()}
              {pkg.questionPack ? (
                <Badge>
                  {packExpiryLabel(
                    packExpiryRule(
                      {
                        expiryMode: pkg.expiryMode ?? "DEFAULT",
                        expiryDays: pkg.expiryDays ?? null,
                        expiresOn: pkg.expiresOn ?? null,
                      },
                      defaultExpiry,
                    ),
                  )}
                  {(pkg.expiryMode ?? "DEFAULT") === "DEFAULT" ? " (ค่าเริ่มต้น)" : ""}
                </Badge>
              ) : null}
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
                : []
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
